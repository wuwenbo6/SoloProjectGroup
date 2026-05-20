import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from material_collection import MaterialCollection
from numerical_computation import NumericalComputation
from collections import defaultdict


class Formula:
    def __init__(self, name: str):
        self.name = name
        self.materials: Dict[str, float] = {}
        self.process_params = {
            'firing_temperature': 800.0,
            'firing_time': 120.0,
            'grinding_time': 60.0,
            'mixing_temperature': 25.0
        }

    def add_material(self, material_name: str, ratio: float) -> None:
        self.materials[material_name] = ratio

    def add_materials(self, materials_dict: Dict[str, float]) -> None:
        for name, ratio in materials_dict.items():
            self.add_material(name, ratio)

    def set_process_param(self, param_name: str, value: float) -> None:
        self.process_params[param_name] = value

    def set_process_params(self, params_dict: Dict[str, float]) -> None:
        for name, value in params_dict.items():
            self.set_process_param(name, value)

    def normalize_ratios(self) -> None:
        total = sum(self.materials.values())
        if total > 0:
            for name in self.materials:
                self.materials[name] /= total

    def get_ratios_array(self, material_names: List[str]) -> np.ndarray:
        return np.array([self.materials.get(name, 0.0) for name in material_names])

    def get_materials_by_type(self, material_type: str) -> List[str]:
        return [name for name in self.materials.keys() 
                if self._get_material_type(name) == material_type]

    def _get_material_type(self, material_name: str) -> Optional[str]:
        from material_collection import MaterialCollection
        mc = MaterialCollection()
        mat = mc.get_material(material_name)
        return mat.material_type if mat else None

    def get_ratio_by_type(self, material_type: str) -> float:
        return sum(ratio for name, ratio in self.materials.items() 
                   if self._get_material_type(name) == material_type)


class InkSimulationResult:
    def __init__(self):
        self.properties: Dict = {}
        self.quality_scores: Dict = {}
        self.process_data: Dict = {}
        self.temporal_data: Dict = {}


class FormulaSimulator:
    def __init__(self, material_collection: Optional[MaterialCollection] = None):
        self.material_collection = material_collection or MaterialCollection()
        self.computation = NumericalComputation()

    def simulate_formula(self, formula: Formula) -> InkSimulationResult:
        result = InkSimulationResult()
        
        material_names = list(formula.materials.keys())
        ratios = np.array(list(formula.materials.values()))
        
        if np.sum(ratios) == 0:
            raise ValueError("配方比例之和为零")
        
        ratios = ratios / np.sum(ratios)
        
        result.properties = self._calculate_composite_properties(
            material_names, ratios
        )
        
        result.properties = self._apply_process_effects(
            result.properties, formula.process_params
        )
        
        result.quality_scores = self._calculate_quality_scores(result.properties)
        
        result.process_data = self._simulate_process_dynamics(
            formula.process_params
        )
        
        result.temporal_data = self._simulate_temporal_changes(
            formula.process_params
        )
        
        return result

    def _calculate_composite_properties(self, material_names: List[str], 
                                       ratios: np.ndarray) -> Dict:
        properties = {}
        
        materials = [self.material_collection.get_material(name) 
                    for name in material_names]
        
        soot_ratios = []
        soot_props_list = []
        binder_ratios = []
        binder_props_list = []
        additive_ratios = []
        additive_props_list = []
        
        for name, ratio in zip(material_names, ratios):
            mat = self.material_collection.get_material(name)
            if mat:
                if mat.material_type == 'soot':
                    soot_ratios.append(ratio)
                    soot_props_list.append(mat.properties)
                elif mat.material_type == 'binder':
                    binder_ratios.append(ratio)
                    binder_props_list.append(mat.properties)
                elif mat.material_type == 'additive':
                    additive_ratios.append(ratio)
                    additive_props_list.append(mat.properties)
        
        total_soot = sum(soot_ratios) if soot_ratios else 0
        total_binder = sum(binder_ratios) if binder_ratios else 0
        total_additive = sum(additive_ratios) if additive_ratios else 0
        
        properties['soot_ratio'] = total_soot
        properties['binder_ratio'] = total_binder
        properties['additive_ratio'] = total_additive
        
        if total_soot > 0 and soot_props_list:
            soot_ratios_np = np.array(soot_ratios) / total_soot
            properties['carbon_content'] = self.computation.weighted_average(
                np.array([p.get('carbon_content', 0) for p in soot_props_list]),
                soot_ratios_np
            )
            properties['particle_size'] = self.computation.weighted_average(
                np.array([p.get('particle_size', 0) for p in soot_props_list]),
                soot_ratios_np
            )
            properties['base_blackness'] = self.computation.weighted_average(
                np.array([p.get('blackness', 0) for p in soot_props_list]),
                soot_ratios_np
            )
            properties['base_gloss'] = self.computation.weighted_average(
                np.array([p.get('gloss', 0) for p in soot_props_list]),
                soot_ratios_np
            )
        
        if total_binder > 0 and binder_props_list:
            binder_ratios_np = np.array(binder_ratios) / total_binder
            properties['binding_power'] = self.computation.weighted_average(
                np.array([p.get('binding_power', 0) for p in binder_props_list]),
                binder_ratios_np
            )
            properties['viscosity'] = self.computation.weighted_average(
                np.array([p.get('viscosity', 0) for p in binder_props_list]),
                binder_ratios_np
            )
            properties['water_resistance'] = self.computation.weighted_average(
                np.array([p.get('water_resistance', 0) for p in binder_props_list]),
                binder_ratios_np
            )
        
        if total_additive > 0 and additive_props_list:
            additive_ratios_np = np.array(additive_ratios) / total_additive
            properties['gloss_enhance'] = self.computation.weighted_average(
                np.array([p.get('gloss_enhance', 0) for p in additive_props_list]),
                additive_ratios_np
            )
            properties['smoothness'] = self.computation.weighted_average(
                np.array([p.get('smoothness', 0) for p in additive_props_list]),
                additive_ratios_np
            )
            properties['aroma'] = self.computation.weighted_average(
                np.array([p.get('aroma', 0) for p in additive_props_list]),
                additive_ratios_np
            )
        
        return properties

    def _apply_process_effects(self, properties: Dict, 
                               process_params: Dict) -> Dict:
        temp = process_params.get('firing_temperature', 800.0)
        time = process_params.get('firing_time', 120.0)
        grind_time = process_params.get('grinding_time', 60.0)
        
        carbonization = self.computation.carbonization_degree(
            np.array([temp]), time
        )[0]
        
        properties['carbonization_degree'] = carbonization
        
        if 'base_blackness' in properties and 'particle_size' in properties:
            properties['final_blackness'] = self.computation.calculate_blackness(
                properties.get('carbon_content', 0.9),
                properties.get('particle_size', 0.1),
                carbonization
            )
        
        if 'binder_ratio' in properties and 'particle_size' in properties:
            smoothness = properties.get('smoothness', 0.5) + 0.3 * min(1.0, grind_time / 120)
            properties['final_gloss'] = self.computation.calculate_gloss(
                properties.get('binder_ratio', 0.2),
                properties.get('particle_size', 0.1),
                smoothness
            )
        
        if 'gloss_enhance' in properties:
            properties['final_gloss'] = properties.get('final_gloss', 50) * \
                (1 + properties['gloss_enhance'])
        
        particle_reduction = 0.3 * min(1.0, grind_time / 180)
        properties['final_particle_size'] = properties.get('particle_size', 0.1) * \
            (1 - particle_reduction)
        
        return properties

    def _calculate_quality_scores(self, properties: Dict) -> Dict:
        scores = {}
        
        blackness = properties.get('final_blackness', 50)
        scores['blackness_score'] = min(100, blackness)
        
        gloss = properties.get('final_gloss', 30)
        scores['gloss_score'] = min(100, gloss)
        
        carbon_content = properties.get('carbon_content', 0.8)
        binding_power = properties.get('binding_power', 0.7)
        water_resistance = properties.get('water_resistance', 0.5)
        scores['durability_score'] = self.computation.calculate_durability(
            carbon_content, binding_power, water_resistance
        )
        
        particle_size = properties.get('final_particle_size', 0.1)
        smoothness = properties.get('smoothness', 0.5)
        scores['smoothness_score'] = 100 * (0.6 * (1 - particle_size / 0.2) + 
                                            0.4 * smoothness)
        
        carbonization = properties.get('carbonization_degree', 0.5)
        scores['firing_quality'] = 100 * carbonization
        
        scores['overall_quality'] = (
            0.35 * scores['blackness_score'] +
            0.25 * scores['gloss_score'] +
            0.20 * scores['durability_score'] +
            0.10 * scores['smoothness_score'] +
            0.10 * scores['firing_quality']
        )
        
        return scores

    def _simulate_process_dynamics(self, process_params: Dict) -> Dict:
        data = {}
        
        temp = process_params.get('firing_temperature', 800.0)
        time = process_params.get('firing_time', 120.0)
        
        time_points = np.linspace(0, time, 50)
        temp_profile = np.where(
            time_points < 30,
            25 + (temp - 25) * (time_points / 30) ** 2,
            temp
        )
        
        carbonization = self.computation.carbonization_degree(
            temp_profile, time_points
        )
        
        data['time_points'] = time_points
        data['temperature_profile'] = temp_profile
        data['carbonization_curve'] = carbonization
        
        return data

    def _simulate_temporal_changes(self, process_params: Dict) -> Dict:
        data = {}
        
        time_hours = np.linspace(0, 72, 100)
        
        drying_rate = 0.05
        moisture_content = np.exp(-drying_rate * time_hours)
        
        hardness = 1 - np.exp(-0.03 * time_hours)
        
        data['time_hours'] = time_hours
        data['moisture_content'] = moisture_content
        data['hardness_development'] = hardness
        
        return data

    def simulate_parameter_sweep(self, formula: Formula, 
                                 param_name: str,
                                 param_range: np.ndarray) -> Dict:
        results = {
            'param_values': param_range,
            'overall_quality': [],
            'blackness': [],
            'gloss': [],
            'durability': []
        }
        
        original_value = formula.process_params.get(param_name, None)
        
        for value in param_range:
            formula.set_process_param(param_name, value)
            sim_result = self.simulate_formula(formula)
            results['overall_quality'].append(sim_result.quality_scores['overall_quality'])
            results['blackness'].append(sim_result.quality_scores['blackness_score'])
            results['gloss'].append(sim_result.quality_scores['gloss_score'])
            results['durability'].append(sim_result.quality_scores['durability_score'])
        
        if original_value is not None:
            formula.set_process_param(param_name, original_value)
        
        for key in results:
            if key != 'param_values':
                results[key] = np.array(results[key])
        
        return results

    def compare_formulas(self, formulas: List[Formula]) -> List[InkSimulationResult]:
        return [self.simulate_formula(f) for f in formulas]

    def simulate_multi_material_synergy(self, base_formula: Formula,
                                        material_combinations: Optional[List[Dict[str, float]]] = None,
                                        n_samples: int = 50,
                                        method: str = 'lhs') -> Dict:
        if material_combinations is None:
            material_combinations = self._generate_material_combinations(
                base_formula, n_samples, method
            )
        
        results = []
        for combo in material_combinations:
            formula = Formula(f"Combo_{len(results)}")
            formula.materials = combo.copy()
            formula.process_params = base_formula.process_params.copy()
            
            try:
                sim_result = self.simulate_formula(formula)
                results.append({
                    'materials': combo,
                    'quality_scores': sim_result.quality_scores,
                    'properties': sim_result.properties,
                    'overall_quality': sim_result.quality_scores['overall_quality']
                })
            except Exception as e:
                results.append({
                    'materials': combo,
                    'error': str(e),
                    'overall_quality': 0
                })
        
        results.sort(key=lambda x: x['overall_quality'], reverse=True)
        
        top_5 = results[:5]
        avg_quality = np.mean([r['overall_quality'] for r in results if r['overall_quality'] > 0])
        
        material_contributions = self._calculate_material_contributions(results)
        
        return {
            'total_combinations': len(results),
            'valid_combinations': sum(1 for r in results if r['overall_quality'] > 0),
            'average_quality': float(avg_quality),
            'best_quality': results[0]['overall_quality'] if results else 0,
            'top_5_formulas': top_5,
            'all_results': results,
            'material_contributions': material_contributions,
            'method': method
        }

    def _generate_material_combinations(self, base_formula: Formula,
                                         n_samples: int,
                                         method: str = 'lhs') -> List[Dict[str, float]]:
        material_names = list(base_formula.materials.keys())
        n_materials = len(material_names)
        
        if n_materials < 2:
            return [base_formula.materials.copy()]
        
        combinations = []
        
        if method == 'lhs':
            from scipy.stats import qmc
            sampler = qmc.LatinHypercube(d=n_materials, seed=42)
            sample = sampler.random(n=n_samples)
            
            for row in sample:
                combo = {}
                total = 0
                for i, name in enumerate(material_names):
                    base_ratio = base_formula.materials.get(name, 1.0 / n_materials)
                    ratio = base_ratio * (0.5 + row[i])
                    combo[name] = ratio
                    total += ratio
                
                for name in combo:
                    combo[name] /= total
                combinations.append(combo)
        
        elif method == 'random':
            np.random.seed(42)
            for _ in range(n_samples):
                combo = {}
                ratios = np.random.dirichlet(np.ones(n_materials))
                for i, name in enumerate(material_names):
                    combo[name] = ratios[i]
                combinations.append(combo)
        
        elif method == 'grid':
            steps = int(n_samples ** (1 / n_materials))
            if steps < 2:
                steps = 2
            
            grids = []
            for _ in range(n_materials):
                grids.append(np.linspace(0.1, 0.9, steps))
            
            mesh = np.meshgrid(*grids)
            points = np.column_stack([m.flatten() for m in mesh])
            
            for row in points[:n_samples]:
                combo = {}
                total = np.sum(row)
                for i, name in enumerate(material_names):
                    combo[name] = row[i] / total
                combinations.append(combo)
        
        return combinations

    def _calculate_material_contributions(self, results: List[Dict]) -> Dict[str, float]:
        valid_results = [r for r in results if r['overall_quality'] > 0]
        if not valid_results:
            return {}
        
        material_names = set()
        for r in valid_results:
            material_names.update(r['materials'].keys())
        material_names = list(material_names)
        
        contributions = {}
        for mat_name in material_names:
            ratios = []
            qualities = []
            for r in valid_results:
                if mat_name in r['materials']:
                    ratios.append(r['materials'][mat_name])
                    qualities.append(r['overall_quality'])
            
            if len(ratios) > 1:
                corr = np.corrcoef(ratios, qualities)[0, 1]
                contributions[mat_name] = float(corr) if not np.isnan(corr) else 0
            else:
                contributions[mat_name] = 0
        
        return contributions

    def batch_simulate(self, formulas: List[Formula], 
                       use_parallel: bool = False,
                       n_jobs: int = -1) -> List[InkSimulationResult]:
        if not use_parallel or len(formulas) < 10:
            return [self.simulate_formula(f) for f in formulas]
        
        try:
            from joblib import Parallel, delayed
            return Parallel(n_jobs=n_jobs)(
                delayed(self.simulate_formula)(f) for f in formulas
            )
        except ImportError:
            return [self.simulate_formula(f) for f in formulas]

    def sensitivity_analysis_matrix(self, formula: Formula,
                                     param_ranges: Dict[str, Tuple[float, float]],
                                     n_points: int = 10) -> Dict:
        param_names = list(param_ranges.keys())
        base_result = self.simulate_formula(formula)
        base_quality = base_result.quality_scores['overall_quality']
        
        sensitivity_matrix = {}
        
        for param_name in param_names:
            low, high = param_ranges[param_name]
            original_value = formula.process_params.get(param_name, (low + high) / 2)
            
            values = np.linspace(low, high, n_points)
            qualities = []
            
            for value in values:
                formula.set_process_param(param_name, value)
                try:
                    result = self.simulate_formula(formula)
                    qualities.append(result.quality_scores['overall_quality'])
                except:
                    qualities.append(base_quality)
            
            formula.set_process_param(param_name, original_value)
            
            sensitivity_matrix[param_name] = {
                'values': values,
                'qualities': np.array(qualities),
                'sensitivity': np.max(qualities) - np.min(qualities),
                'optimal_value': values[np.argmax(qualities)],
                'max_quality': np.max(qualities),
                'min_quality': np.min(qualities)
            }
        
        return sensitivity_matrix
