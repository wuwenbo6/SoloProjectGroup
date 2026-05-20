#!/usr/bin/env python3
import sys
import json
import re
from math import gcd
from functools import reduce

def parse_equation(equation):
    equation = equation.strip()
    equation = equation.replace(' ', '')
    
    subscript_map = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'}
    for sub, num in subscript_map.items():
        equation = equation.replace(sub, num)
    
    equation = equation.replace('→', '->').replace('=', '->').replace('→', '->').replace('→', '->')
    
    if '->' not in equation:
        raise ValueError("无效的方程式格式，请使用 -> 分隔反应物和生成物")
    
    left, right = equation.split('->', 1)
    
    if not left or not right:
        raise ValueError("反应物或生成物不能为空")
    
    reactants = [r for r in left.split('+') if r]
    products = [p for p in right.split('+') if p]
    
    if not reactants:
        raise ValueError("至少需要一个反应物")
    if not products:
        raise ValueError("至少需要一个生成物")
    
    return reactants, products

def parse_formula(formula):
    if not formula:
        return {}
    
    pattern = r'([A-Z][a-z]?)(\d*)'
    elements = {}
    
    matches = list(re.finditer(pattern, formula))
    
    if not matches:
        raise ValueError(f"无效的化学式: {formula}")
    
    parsed_length = sum(m.end() - m.start() for m in matches)
    if parsed_length < len(formula):
        pass
    
    for match in matches:
        element = match.group(1)
        count_str = match.group(2)
        count = int(count_str) if count_str else 1
        elements[element] = elements.get(element, 0) + count
    
    if not elements:
        raise ValueError(f"无法解析化学式: {formula}")
    
    return elements

def build_matrix(reactants, products):
    all_elements = set()
    reactant_elements = []
    product_elements = []
    
    for r in reactants:
        elements = parse_formula(r)
        if not elements:
            raise ValueError(f"无法解析反应物: {r}")
        reactant_elements.append(elements)
        all_elements.update(elements.keys())
    
    for p in products:
        elements = parse_formula(p)
        if not elements:
            raise ValueError(f"无法解析生成物: {p}")
        product_elements.append(elements)
        all_elements.update(elements.keys())
    
    if not all_elements:
        raise ValueError("未检测到任何化学元素")
    
    product_elements_set = set()
    for pe in product_elements:
        product_elements_set.update(pe.keys())
    
    if all_elements != product_elements_set:
        missing_in_products = all_elements - product_elements_set
        extra_in_products = product_elements_set - all_elements
        if missing_in_products:
            raise ValueError(f"生成物中缺少元素: {', '.join(missing_in_products)}")
        if extra_in_products:
            raise ValueError(f"反应物中缺少元素: {', '.join(extra_in_products)}")
    
    all_elements = sorted(all_elements)
    n_compounds = len(reactants) + len(products)
    n_elements = len(all_elements)
    
    matrix = []
    for element in all_elements:
        row = []
        for i, re in enumerate(reactant_elements):
            row.append(re.get(element, 0))
        for i, pe in enumerate(product_elements):
            row.append(-pe.get(element, 0))
        matrix.append(row)
    
    return matrix, all_elements

def gcd_list(numbers):
    return reduce(gcd, numbers)

def lcm(a, b):
    return abs(a * b) // gcd(a, b)

def lcm_list(numbers):
    return reduce(lcm, numbers)

def solve_integer_solution(matrix):
    n_rows = len(matrix)
    n_cols = len(matrix[0]) if n_rows > 0 else 0
    
    if n_cols == 0:
        raise ValueError("空矩阵")
    
    from itertools import product
    
    max_coeff = 50
    step = 1
    
    for coeffs in product(range(1, max_coeff + 1, step), repeat=n_cols):
        valid = True
        for row in matrix:
            total = sum(row[i] * coeffs[i] for i in range(n_cols))
            if total != 0:
                valid = False
                break
        if valid:
            common = gcd_list(coeffs)
            if common > 1:
                coeffs = tuple(c // common for c in coeffs)
            return list(coeffs)
    
    hint = "尝试简化方程式或检查化学式是否正确"
    raise ValueError(f"无法在系数1-{max_coeff}范围内找到整数解。{hint}")

def balance_equation(equation):
    try:
        reactants, products = parse_equation(equation)
        matrix, elements = build_matrix(reactants, products)
        coefficients = solve_integer_solution(matrix)
        
        balanced_reactants = []
        for i, r in enumerate(reactants):
            coeff = coefficients[i]
            if coeff == 1:
                balanced_reactants.append(r)
            else:
                balanced_reactants.append(f"{coeff}{r}")
        
        balanced_products = []
        for i, p in enumerate(products):
            coeff = coefficients[i + len(reactants)]
            if coeff == 1:
                balanced_products.append(p)
            else:
                balanced_products.append(f"{coeff}{p}")
        
        balanced_equation = " + ".join(balanced_reactants) + " -> " + " + ".join(balanced_products)
        
        return {
            "success": True,
            "balanced_equation": balanced_equation,
            "reactants": reactants,
            "products": products,
            "matrix": matrix,
            "elements": elements,
            "coefficients": coefficients
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            request = json.loads(line)
            equation = request.get("equation", "")
            formula = request.get("formula", "")
            request_id = request.get("id", "")
            mode = request.get("mode", "normal")
            action = request.get("action", "balance")
            equation_data = request.get("equation_data", None)
            
            if action == "balance":
                result = balance_equation(equation)
            elif action == "balance_ionic":
                result = balance_ionic_equation(equation)
            elif action == "balance_combustion":
                result = balance_combustion(formula)
            elif action == "export_latex":
                result = export_latex(equation_data, mode)
            else:
                result = {
                    "success": False,
                    "error": f"未知的操作: {action}"
                }
            
            result["id"] = request_id
            
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "id": request.get("id", "") if 'request' in locals() else ""
            }
            print(json.dumps(error_result, ensure_ascii=False))
            sys.stdout.flush()

def balance_ionic_equation(equation):
    """配平离子方程式（使用代数方法优化性能）"""
    try:
        equation_clean = equation.replace(' ', '')
        
        def parse_formula_with_charge(formula):
            """解析带有电荷的化学式"""
            charge = 0
            pure_formula = formula
            
            match = re.search(r'\(([+-])(\d*)\)$', formula)
            if match:
                sign = match.group(1)
                num = match.group(2)
                charge = int(num) if num else 1
                if sign == '-':
                    charge = -charge
                pure_formula = formula[:match.start()]
            else:
                match = re.search(r'([+-])(\d*)$', formula)
                if match:
                    sign = match.group(1)
                    num = match.group(2)
                    charge = int(num) if num else 1
                    if sign == '-':
                        charge = -charge
                    pure_formula = formula[:match.start()]
            
            return pure_formula, charge
        
        reactants, products = parse_equation(equation_clean)
        
        reactant_charges = []
        product_charges = []
        pure_reactants = []
        pure_products = []
        
        for r in reactants:
            pf, ch = parse_formula_with_charge(r)
            pure_reactants.append(pf)
            reactant_charges.append(ch)
        
        for p in products:
            pf, ch = parse_formula_with_charge(p)
            pure_products.append(pf)
            product_charges.append(ch)
        
        all_compounds = pure_reactants + pure_products
        n_compounds = len(all_compounds)
        
        def parse_pure_formula(formula):
            pattern = r'([A-Z][a-z]?)(\d*)'
            elements = {}
            for match in re.finditer(pattern, formula):
                element = match.group(1)
                count = int(match.group(2)) if match.group(2) else 1
                elements[element] = elements.get(element, 0) + count
            return elements
        
        all_elements = set()
        element_counts = []
        
        for c in all_compounds:
            elements = parse_pure_formula(c)
            element_counts.append(elements)
            all_elements.update(elements.keys())
        
        if not all_elements:
            raise ValueError("未检测到任何化学元素")
        
        all_elements = sorted(all_elements)
        
        n_vars = n_compounds - 1
        if n_vars <= 0:
            raise ValueError("化合物数量不足")
        
        from itertools import product
        
        max_coeff = 20
        
        for coeffs_partial in product(range(1, max_coeff + 1), repeat=n_vars):
            coeffs = list(coeffs_partial) + [1]
            
            element_balance = True
            for element in all_elements:
                left_total = sum(
                    element_counts[i].get(element, 0) * coeffs[i] 
                    for i in range(len(pure_reactants))
                )
                right_total = sum(
                    element_counts[i + len(pure_reactants)].get(element, 0) * coeffs[i + len(pure_reactants)]
                    for i in range(len(pure_products))
                )
                if left_total != right_total:
                    element_balance = False
                    break
            
            if not element_balance:
                continue
            
            charge_left = sum(
                reactant_charges[i] * coeffs[i] 
                for i in range(len(pure_reactants))
            )
            charge_right = sum(
                product_charges[i] * coeffs[i + len(pure_reactants)]
                for i in range(len(pure_products))
            )
            
            if charge_left == charge_right:
                common = gcd_list(coeffs)
                if common > 1:
                    coeffs = [c // common for c in coeffs]
                
                balanced_reactants = []
                for i in range(len(pure_reactants)):
                    coeff = coeffs[i]
                    formula = pure_reactants[i]
                    if reactant_charges[i] != 0:
                        charge_str = ''
                        if abs(reactant_charges[i]) > 1:
                            charge_str = str(abs(reactant_charges[i]))
                        charge_str += '+' if reactant_charges[i] > 0 else '-'
                        formula += f'({charge_str})'
                    if coeff == 1:
                        balanced_reactants.append(formula)
                    else:
                        balanced_reactants.append(f"{coeff}{formula}")
                
                balanced_products = []
                for i in range(len(pure_products)):
                    coeff = coeffs[i + len(pure_reactants)]
                    formula = pure_products[i]
                    if product_charges[i] != 0:
                        charge_str = ''
                        if abs(product_charges[i]) > 1:
                            charge_str = str(abs(product_charges[i]))
                        charge_str += '+' if product_charges[i] > 0 else '-'
                        formula += f'({charge_str})'
                    if coeff == 1:
                        balanced_products.append(formula)
                    else:
                        balanced_products.append(f"{coeff}{formula}")
                
                balanced_equation = " + ".join(balanced_reactants) + " -> " + " + ".join(balanced_products)
                
                return {
                    "success": True,
                    "balanced_equation": balanced_equation,
                    "coefficients": coeffs,
                    "charge_balance": charge_left,
                    "is_ionic": True
                }
        
        raise ValueError("无法在合理范围内找到离子方程式整数解")
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def balance_combustion(formula):
    """有机物燃烧通式配平：CxHy + O2 -> CO2 + H2O 或 CxHyOz + O2 -> CO2 + H2O"""
    try:
        formula = formula.strip().replace(' ', '')
        
        elements = parse_formula(formula)
        C = elements.get('C', 0)
        H = elements.get('H', 0)
        O = elements.get('O', 0)
        
        if C == 0 or H == 0:
            raise ValueError("有机物必须含有C和H元素")
        
        coeff_fuel = 2
        coeff_O2 = 2 * C + H // 2 - O
        coeff_CO2 = 2 * C
        coeff_H2O = H
        
        common = gcd_list([coeff_fuel, coeff_O2, coeff_CO2, coeff_H2O])
        if common > 1:
            coeff_fuel //= common
            coeff_O2 //= common
            coeff_CO2 //= common
            coeff_H2O //= common
        
        if coeff_O2 <= 0:
            raise ValueError("氧气系数为负，无法配平")
        
        fuel_str = formula if coeff_fuel == 1 else f"{coeff_fuel}{formula}"
        O2_str = "O2" if coeff_O2 == 1 else f"{coeff_O2}O2"
        CO2_str = "CO2" if coeff_CO2 == 1 else f"{coeff_CO2}CO2"
        H2O_str = "H2O" if coeff_H2O == 1 else f"{coeff_H2O}H2O"
        
        balanced_equation = f"{fuel_str} + {O2_str} -> {CO2_str} + {H2O_str}"
        
        return {
            "success": True,
            "balanced_equation": balanced_equation,
            "formula": formula,
            "C": C,
            "H": H,
            "O": O,
            "coefficients": [coeff_fuel, coeff_O2, coeff_CO2, coeff_H2O],
            "is_combustion": True
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def export_latex(equation_data, mode='normal'):
    """导出LaTeX格式的化学方程式
    
    mode: 'normal' - 普通化学式, 'ion' - 离子化学式
    """
    try:
        if not equation_data.get('success', False):
            return {
                "success": False,
                "error": "配平失败，无法导出LaTeX"
            }
        
        equation = equation_data['balanced_equation']
        
        def formula_to_latex(formula, is_ion=False):
            """将化学式转换为LaTeX格式"""
            result = formula
            
            result = re.sub(r'([A-Za-z)])(\d+)', r'\1$_{\text{\2}}$', result)
            
            if is_ion:
                def replace_charge(match):
                    sign = match.group(1)
                    num = match.group(2)
                    if num:
                        return f'$^{{{num}{sign}}}$'
                    else:
                        return f'$^{{{sign}}}$'
                
                result = re.sub(r'\(([+-])(\d*)\)$', replace_charge, result)
            
            return result
        
        parts = equation.split(' -> ')
        if len(parts) != 2:
            return {
                "success": False,
                "error": "方程式格式错误"
            }
        
        left_parts = parts[0].split(' + ')
        right_parts = parts[1].split(' + ')
        
        latex_left = ' + '.join([formula_to_latex(p, is_ion=(mode == 'ion')) for p in left_parts])
        latex_right = ' + '.join([formula_to_latex(p, is_ion=(mode == 'ion')) for p in right_parts])
        
        latex_equation = f"$$ {latex_left} \\rightarrow {latex_right} $$"
        
        inline_latex = f"{latex_left} \\rightarrow {latex_right}"
        
        chemformula_latex = f"\\ch{{{equation.replace('->', ' -> ')}}}"
        
        return {
            "success": True,
            "display_latex": latex_equation,
            "inline_latex": inline_latex,
            "chemformula_latex": chemformula_latex,
            "original_equation": equation
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    main()
