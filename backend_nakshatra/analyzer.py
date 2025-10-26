import sys
import re
from wordfreq import zipf_frequency
# The following imports are now removed as they are no longer needed:
# from sentence_transformers import SentenceTransformer, util

def is_meaningful(text, threshold=2.5):
    # This function remains unchanged as it checks for meaningfulness
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if not words:
        return False
    valid_words = 0
    for w in words:
        freq = zipf_frequency(w, 'en')
        if freq > threshold:
            valid_words += 1
    ratio = valid_words / len(words)
    return ratio > 0.5

# The is_relevant_to_topic function has been removed.

def analyze_input(text): # 'topic' argument removed
    if is_meaningful(text):
        print("Good Text")
    else:
        print("Garbage Text")

if __name__ == "__main__":
    text = sys.argv[1] # Only read the first argument (the text)
    # The topic argument (sys.argv[2]) is no longer needed or read.
    analyze_input(text)