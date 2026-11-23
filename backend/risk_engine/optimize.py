"""Run: python optimize.py --years 20000 --seed 2026 --ciso I01 I04 I06"""
import argparse,json
from engine.portfolio_model import optimize
from engine.comparison import compare
from engine.investments import validate_portfolio

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--years',type=int,default=20000)
    parser.add_argument('--seed',type=int,default=2026)
    parser.add_argument('--uncertainty-mode',choices=['central','epistemic_draw'],default='central')
    parser.add_argument('--ciso',nargs='*',default=['I01','I04','I06'])
    args=parser.parse_args()
    chosen=validate_portfolio(args.ciso)
    optimum=optimize()
    comparison=compare(args.years,args.seed,{'baseline':(), 'ciso':chosen,'optimized':tuple(optimum['selected_investments'])},uncertainty_mode=args.uncertainty_mode)
    print(json.dumps({'optimization':optimum,'monte_carlo':comparison},indent=2))
