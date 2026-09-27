import { VisualizationScene, VisualizationMode, WhiteboardAction } from '../../features/classroom/visualizationTypes';
import { Whiteboard } from './Whiteboard';
import { SimulationRenderer } from './simulationRenderer';
import { DiagramRenderer } from './diagramRenderer';
import { MathGraphRenderer } from './mathGraphRenderer';
import { CodeTraceRenderer } from './codeTraceRenderer';
import { ChartRenderer } from './chartRenderer';
import { TimelineRenderer } from './timelineRenderer';

interface DynamicVisualizerProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  interactive?: boolean;
  readOnly?: boolean;
  onAction?: (action: WhiteboardAction | Record<string, unknown>) => void;
}

export function DynamicVisualizer({
  scene,
  width = 800,
  height = 600,
  autoPlay = true,
  interactive = false,
  readOnly = false,
  onAction,
}: DynamicVisualizerProps) {
  const mode = scene.mode;

  if (mode === VisualizationMode.WHITEBOARD || interactive) {
    return <Whiteboard scene={scene} width={width} height={height} readOnly={readOnly} onAction={onAction} />;
  }
  if (mode === VisualizationMode.SIMULATION || mode === VisualizationMode.ANIMATION) {
    return <SimulationRenderer scene={scene} width={width} height={height} autoPlay={autoPlay} />;
  }
  if (mode === VisualizationMode.DIAGRAM || mode === VisualizationMode.NETWORK || mode === VisualizationMode.MINIMAP || mode === VisualizationMode.INFOGRAPHIC) {
    return <DiagramRenderer scene={scene} width={width} height={height} />;
  }
  if (mode === VisualizationMode.MATH_GRAPH) {
    return <MathGraphRenderer scene={scene} width={width} height={height} />;
  }
  if (mode === VisualizationMode.CODE_TRACE) {
    return <CodeTraceRenderer scene={scene} width={width} height={height} />;
  }
  if (mode === VisualizationMode.CHART) {
    return <ChartRenderer scene={scene} width={width} height={height} />;
  }
  if (mode === VisualizationMode.TIMELINE) {
    return <TimelineRenderer scene={scene} width={width} height={height} />;
  }
  if (mode === VisualizationMode.CANVAS_2D || mode === VisualizationMode.FLOWCHART) {
    return <DiagramRenderer scene={scene} width={width} height={height} />;
  }

  return <DiagramRenderer scene={scene} width={width} height={height} />;
}
