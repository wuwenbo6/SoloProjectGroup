const DEFAULT_TEMPLATES = [
  {
    id: 'basic_fraction',
    name: '分数',
    category: '基础',
    latex: '\\frac{a}{b}',
    description: '基础分数表达式',
    builtin: true,
  },
  {
    id: 'quadratic_formula',
    name: '二次方程求根公式',
    category: '代数',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    description: 'ax² + bx + c = 0 的解',
    builtin: true,
  },
  {
    id: 'matrix_2x2',
    name: '2×2矩阵',
    category: '矩阵',
    latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    description: '2行2列矩阵',
    builtin: true,
  },
  {
    id: 'matrix_3x3',
    name: '3×3矩阵',
    category: '矩阵',
    latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}',
    description: '3行3列矩阵',
    builtin: true,
  },
  {
    id: 'determinant',
    name: '行列式',
    category: '矩阵',
    latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}',
    description: '2×2行列式',
    builtin: true,
  },
  {
    id: 'integral',
    name: '定积分',
    category: '微积分',
    latex: '\\int_{a}^{b} f(x) dx',
    description: '从a到b的定积分',
    builtin: true,
  },
  {
    id: 'definite_integral',
    name: '不定积分',
    category: '微积分',
    latex: '\\int f(x) dx',
    description: '不定积分表达式',
    builtin: true,
  },
  {
    id: 'derivative',
    name: '导数',
    category: '微积分',
    latex: '\\frac{d}{dx} f(x)',
    description: '函数f(x)对x的一阶导数',
    builtin: true,
  },
  {
    id: 'partial_derivative',
    name: '偏导数',
    category: '微积分',
    latex: '\\frac{\\partial f}{\\partial x}',
    description: '函数f对x的偏导数',
    builtin: true,
  },
  {
    id: 'sum',
    name: '求和',
    category: '基础',
    latex: '\\sum_{i=1}^{n} x_i',
    description: '从i=1到n的求和',
    builtin: true,
  },
  {
    id: 'product',
    name: '乘积',
    category: '基础',
    latex: '\\prod_{i=1}^{n} x_i',
    description: '从i=1到n的乘积',
    builtin: true,
  },
  {
    id: 'limit',
    name: '极限',
    category: '微积分',
    latex: '\\lim_{x \\to \\infty} f(x)',
    description: 'x趋向无穷时的极限',
    builtin: true,
  },
  {
    id: 'vector',
    name: '向量',
    category: '向量',
    latex: '\\vec{v} = \\begin{pmatrix} v_1 \\\\ v_2 \\\\ v_3 \\end{pmatrix}',
    description: '三维列向量',
    builtin: true,
  },
  {
    id: 'eigenvalue',
    name: '特征值方程',
    category: '线性代数',
    latex: 'A\\vec{v} = \\lambda\\vec{v}',
    description: '特征值特征向量方程',
    builtin: true,
  },
  {
    id: 'greek_alphab',
    name: '希腊字母',
    category: '基础',
    latex: '\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\pi',
    description: '常用希腊字母',
    builtin: true,
  },
  {
    id: 'complex_number',
    name: '复数',
    category: '基础',
    latex: 'z = x + yi = r(\\cos\\theta + i\\sin\\theta)',
    description: '复数的代数和三角形式',
    builtin: true,
  },
  {
    id: 'binomial',
    name: '二项式系数',
    category: '代数',
    latex: '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}',
    description: '组合数公式',
    builtin: true,
  },
  {
    id: 'cases',
    name: '分段函数',
    category: '基础',
    latex: 'f(x) = \\begin{cases} x & \\text{if } x > 0} \\\\ -x & \\text{otherwise} \\end{cases}',
    description: '条件分支函数定义',
    builtin: true,
  },
];

const STORAGE_KEY = 'latex_templates';

class TemplateService {
  constructor() {
    this.templates = [];
    this.categories = new Set();
    this.init();
  }

  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.templates = JSON.parse(saved);
      } catch {
        this.templates = [...DEFAULT_TEMPLATES];
      }
    } else {
      this.templates = [...DEFAULT_TEMPLATES];
    }
    this.updateCategories();
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates));
  }

  updateCategories() {
    this.categories.clear();
    this.templates.forEach(t => this.categories.add(t.category));
  }

  getAllTemplates() {
    return [...this.templates];
  }

  getTemplateById(id) {
    return this.templates.find(t => t.id === id);
  }

  getTemplatesByCategory(category) {
    return this.templates.filter(t => t.category === category);
  }

  getAllCategories() {
    return Array.from(this.categories);
  }

  searchTemplates(query) {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery) ||
      t.latex.toLowerCase().includes(lowerQuery)
    );
  }

  addTemplate(template) {
    const newTemplate = {
      ...template,
      id: template.id || `custom_${Date.now()}`,
      builtin: false,
    };
    this.templates.push(newTemplate);
    this.updateCategories();
    this.save();
    return newTemplate;
  }

  updateTemplate(id, updates) {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const template = this.templates[index];
    if (template.builtin) {
      throw new Error('Cannot modify built-in templates');
    }
    
    this.templates[index] = { ...template, ...updates };
    this.updateCategories();
    this.save();
    return this.templates[index];
  }

  deleteTemplate(id) {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    const template = this.templates[index];
    if (template.builtin) {
      throw new Error('Cannot delete built-in templates');
    }
    
    this.templates.splice(index, 1);
    this.updateCategories();
    this.save();
    return true;
  }

  exportTemplates() {
    return JSON.stringify(this.templates.filter(t => !t.builtin), null, 2);
  }

  importTemplates(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      const customTemplates = this.templates.filter(t => t.builtin);
      const merged = [...customTemplates, ...imported.map(t => ({
        ...t,
        id: `${t.id}_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      this.templates = [...DEFAULT_TEMPLATES, ...merged];
      this.updateCategories();
      this.save();
      return merged.length;
    } catch (err) {
      throw new Error('Invalid template format');
    }
  }

  resetToDefaults() {
    this.templates = [...DEFAULT_TEMPLATES];
    this.updateCategories();
    this.save();
  }

  getFavorites() {
    return this.templates.filter(t => t.favorite);
  }

  toggleFavorite(id) {
    const template = this.templates.find(t => t.id === id);
    if (template) {
      template.favorite = !template.favorite;
      this.save();
      return template.favorite;
    }
    return false;
  }

  getRecentTemplates() {
    const recent = localStorage.getItem('latex_recent_templates');
    return recent ? JSON.parse(recent) : [];
  }

  addToRecent(id) {
    let recent = this.getRecentTemplates();
    recent = recent.filter(r => r !== id);
    recent.unshift(id);
    recent = recent.slice(0, 10);
    localStorage.setItem('latex_recent_templates', JSON.stringify(recent));
  }
}

const templateService = new TemplateService();

export default templateService;
