from app.utils.math import cosine_similarity

def test_cosine_similarity():
    assert cosine_similarity([1, 0], [1, 0]) == 1

