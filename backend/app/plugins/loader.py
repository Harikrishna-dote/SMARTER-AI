"""Dynamic plugin discovery and loading.

:class:`PluginLoader` scans a directory for Python files that expose a
``PLUGIN`` object, imports them with :mod:`importlib`, validates their
metadata, and hands them to a :class:`~app.plugins.registry.PluginRegistry`.

Plugins are ordinary Python modules/packages; nothing special needs to be
installed — dropping a file into the configured plugin directory is enough.
"""

from __future__ import annotations

import importlib
import importlib.util
import inspect
import logging
import pkgutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.plugins.base import Plugin, PluginMetadata
from app.plugins.registry import PluginRegistry, get_plugin_registry

logger = logging.getLogger(__name__)


class PluginLoadError(Exception):
    """Raised when a plugin module cannot be loaded or is invalid."""


@dataclass(slots=True)
class LoadedPlugin:
    """Descriptor returned for each successfully loaded plugin."""

    module: str
    plugin: Plugin
    metadata: PluginMetadata


class PluginLoader:
    """Discover and load plugins from a filesystem directory.

    Args:
        plugins_dir: Directory tree to scan.
        registry: Registry to receive loaded plugins. Defaults to the global
            singleton registry.
        package: The Python "anchor" package plugins are imported under.
            ``app.plugins.installed`` by default; plugins are exposed as
            submodules of it.
    """

    def __init__(
        self,
        plugins_dir: Path | str | None = None,
        registry: PluginRegistry | None = None,
        package: str = "app.plugins.installed",
    ) -> None:
        from app.core.config import get_settings

        if plugins_dir is None:
            plugins_dir = Path(get_settings().plugins_directory)
        self.plugins_dir = Path(plugins_dir)
        if not self.plugins_dir.is_absolute():
            backend_root = Path(__file__).resolve().parents[2]
            self.plugins_dir = backend_root / self.plugins_dir
        self.registry: PluginRegistry = registry or get_plugin_registry()
        self.package = package

    def _ensure_package(self) -> None:
        """Create the virtual ``installed`` package so plugins import cleanly."""
        if "." not in self.package:
            return

        pkg_path = self.plugins_dir
        if not pkg_path.exists():
            pkg_path.mkdir(parents=True, exist_ok=True)
        init_file = pkg_path / "__init__.py"
        if not init_file.exists():
            init_file.write_text(
                '"""Auto-generated package for dynamically loaded plugins."""\n',
                encoding="utf-8",
            )

    def discover(self) -> list[Path]:
        """Return candidate plugin module files under ``plugins_dir``."""
        if not self.plugins_dir.exists():
            logger.debug("Plugins directory %s does not exist; nothing to load", self.plugins_dir)
            return []

        candidates: list[Path] = []
        for entry in sorted(self.plugins_dir.rglob("*.py")):
            if entry.name == "__init__.py":
                continue
            candidates.append(entry)
        return candidates

    def _module_name(self, path: Path) -> str:
        """Derive an importable module name for ``path``."""
        rel = path.relative_to(self.plugins_dir.parent).with_suffix("")
        parts = [p for p in rel.parts if p]
        return ".".join([self.package, *parts[1:]])

    def _load_module(self, path: Path) -> Any:
        """Import a module from ``path`` without depending on sys.path hacks."""
        module_name = self._module_name(path)
        if module_name in importlib.sys.modules:
            return importlib.sys.modules[module_name]

        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise PluginLoadError(f"Cannot create spec for plugin at {path}")
        module = importlib.util.module_from_spec(spec)
        importlib.sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except Exception as exc:
            importlib.sys.modules.pop(module_name, None)
            raise PluginLoadError(f"Failed to execute plugin module {path}: {exc}") from exc
        return module

    @staticmethod
    def _validate(plugin: Any) -> PluginMetadata:
        """Ensure ``plugin`` exposes valid :class:`PluginMetadata`."""
        if not isinstance(plugin, Plugin):
            raise PluginLoadError(
                f"Expected a Plugin instance, got {type(plugin).__name__}"
            )
        metadata = getattr(plugin, "metadata", None)
        if not isinstance(metadata, PluginMetadata):
            raise PluginLoadError(
                f"Plugin '{getattr(plugin, 'metadata', None)!r}' lacks a "
                f"PluginMetadata instance"
            )
        if not metadata.name:
            raise PluginLoadError("Plugin metadata.name must be a non-empty string")
        if not metadata.version:
            raise PluginLoadError(f"Plugin '{metadata.name}' has no version")
        return metadata

    def load_module(self, path: Path) -> LoadedPlugin | None:
        """Load a single plugin module file.

        Returns :class:`LoadedPlugin` on success or ``None`` if the module
        defines no plugin. Raises :class:`PluginLoadError` on hard failures
        (invalid metadata, import errors).
        """
        module = self._load_module(path)
        plugin_obj = getattr(module, "PLUGIN", None)
        if plugin_obj is None:
            plugin_obj = getattr(module, "plugin", None)
        if plugin_obj is None:
            for _name, value in vars(module).items():
                if isinstance(value, Plugin):
                    plugin_obj = value
                    break
        if plugin_obj is None:
            return None

        metadata = self._validate(plugin_obj)
        return LoadedPlugin(module=module.__name__, plugin=plugin_obj, metadata=metadata)

    def load_all(self, enabled_only: bool = True) -> list[LoadedPlugin]:
        """Discover and load every plugin under :attr:`plugins_dir`.

        Disabled plugins (metadata enabled=False) are skipped when
        ``enabled_only`` is true. Loaded but duplicate-name plugins raise.

        Returns the list of successfully loaded plugins and registers each
        with the configured :class:`PluginRegistry`.
        """
        self._ensure_package()
        loaded: list[LoadedPlugin] = []
        for path in self.discover():
            try:
                result = self.load_module(path)
            except PluginLoadError as exc:
                logger.error("Skipping plugin %s: %s", path, exc)
                continue
            if result is None:
                continue
            if enabled_only and not result.metadata.enabled:
                logger.info("Skipping disabled plugin %s", result.metadata.name)
                continue
            existing = self.registry.get_plugin(result.metadata.name)
            if existing is not None:
                raise PluginLoadError(
                    f"Plugin name collision: '{result.metadata.name}' "
                    f"(existing={existing.__module__})"
                )
            self.registry.register(result.plugin)
            loaded.append(result)
            logger.info(
                "Loaded plugin '%s' v%s [%s]",
                result.metadata.name,
                result.metadata.version,
                result.metadata.category.value,
            )
        return loaded

    @classmethod
    def scan_and_load(
        cls,
        plugins_dir: Path | str | None = None,
        registry: PluginRegistry | None = None,
    ) -> list[LoadedPlugin]:
        """Convenience classmethod: instantiate, load, and return plugins."""
        loader = cls(plugins_dir=plugins_dir, registry=registry)
        return loader.load_all()
