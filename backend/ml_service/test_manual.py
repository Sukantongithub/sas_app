import sys
import os

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from motion_detector import MotionPatternDetector

def main():
    print("\n=============================================")
    print("  Motion Pattern Detector - Manual Testing")
    print("=============================================\n")
    
    print("Loading Motion Pattern Detector...")
    detector = MotionPatternDetector()
    try:
        detector.load()
        print("✅ Model loaded successfully from saved artifacts.\n")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print("Please ensure you have run the training script first.")
        return

    print("How to test:")
    print("Enter a sequence of motion values separated by commas or spaces.")
    print("For example: 25000, 24800, 25200, 24900, 25100")
    print("Type 'quit' or 'exit' to stop testing.")
    
    while True:
        try:
            user_input = input("\nEnter motion sequence: ")
            if user_input.lower().strip() in ['quit', 'exit']:
                print("Exiting test script.")
                break
                
            # Parse input: Replace commas with spaces, then split by whitespace
            clean_input = user_input.replace(',', ' ')
            values = [float(x) for x in clean_input.split() if x.strip()]
            
            if not values:
                print("⚠️ Please enter valid numeric values.")
                continue
                
            print(f"Analyzing sequence of {len(values)} values...")
            result = detector.predict(values)
            
            print("\n--- 📊 Prediction Results ---")
            print(f"Prediction:          {result['label']}")
            print(f"Confidence:          {result['confidence']:.2%}")
            print(f"Genuine Probability: {result['genuine_probability']:.2%}")
            print(f"Artificial Prob:     {result['artificial_probability']:.2%}")
            print("-----------------------------")
            
        except ValueError:
            print("⚠️ Invalid input! Please enter only numbers separated by commas or spaces.")
        except KeyboardInterrupt:
            print("\nExiting test script.")
            break
        except Exception as e:
            print(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    main()
