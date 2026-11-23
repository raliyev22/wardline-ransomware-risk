"""Run: python main.py --years 20000 --seed 2026"""
import argparse
import json
from dataclasses import asdict
from engine.monte_carlo import simulate

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, default=20000)
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args()
    print(json.dumps(asdict(simulate(args.years, args.seed)), indent=2))
