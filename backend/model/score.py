import numpy as np


def probability_to_score(default_probability: float) -> int:
    return int(np.clip(900 - default_probability * 600, 300, 900))
