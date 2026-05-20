import { Formula, WAX_TYPE_INFO } from '../types';

export function exportToJSON(formula: Formula): string {
  return JSON.stringify(formula, null, 2);
}

export function exportToCSV(formula: Formula): string {
  const headers = [
    '配方名称',
    '创建时间',
    '总重量(g)',
    '燃烧时间(小时)',
    '烟气排放指数',
    '蜡料名称',
    '蜡料类型',
    '重量(g)',
    '百分比(%)',
    '蜡芯类型',
    '蜡芯尺寸',
    '容器名称',
    '容器直径(cm)',
    '容器高度(cm)',
    '容器体积(ml)',
  ];

  const rows: string[][] = [];

  formula.waxes.forEach((wax, index) => {
    if (index === 0) {
      rows.push([
        formula.name,
        formula.createdAt,
        formula.totalWeight.toString(),
        formula.burnTime.toString(),
        formula.smokeEmission.toString(),
        wax.name,
        WAX_TYPE_INFO[wax.type].name,
        wax.weight.toString(),
        wax.percentage.toFixed(2),
        formula.wick.type,
        formula.wick.size,
        formula.container.name,
        formula.container.diameter.toString(),
        formula.container.height.toString(),
        formula.container.volume.toString(),
      ]);
    } else {
      rows.push([
        '', '', '', '', '',
        wax.name,
        WAX_TYPE_INFO[wax.type].name,
        wax.weight.toString(),
        wax.percentage.toFixed(2),
        '', '', '', '', '',
      ]);
    }
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  let blobContent: string | Uint8Array = content;
  if (mimeType === 'text/csv') {
    const BOM = '\uFEFF';
    blobContent = new Uint8Array([...new TextEncoder().encode(BOM + content)]);
  }
  const blob = new Blob([blobContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFormula(formula: Formula, format: 'json' | 'csv'): void {
  if (format === 'json') {
    const content = exportToJSON(formula);
    downloadFile(content, `${formula.name}.json`, 'application/json');
  } else {
    const content = exportToCSV(formula);
    downloadFile(content, `${formula.name}.csv`, 'text/csv');
  }
}

export function exportBatchFormulas(formulas: Formula[], format: 'json' | 'csv'): void {
  if (format === 'json') {
    const content = JSON.stringify(formulas, null, 2);
    downloadFile(content, 'batch_formulas.json', 'application/json');
  } else {
    const allRows = formulas.map((f, idx) => {
      if (idx === 0) return exportToCSV(f);
      const csv = exportToCSV(f);
      return csv.split('\n').slice(1).join('\n');
    }).join('\n');
    downloadFile(allRows, 'batch_formulas.csv', 'text/csv');
  }
}
