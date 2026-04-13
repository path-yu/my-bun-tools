import { Drawing, DrawingCategory } from './types'

export const mockDrawings: Drawing[] = [
  {
    id: '1',
    materialCode: 'MAT-SS-001',
    drawingNumber: 'DWG-001-A',
    filePath: '/drawings/stainless/dwg-001-a.pdf',
    pressure: '1.6MPa',
    volume: '500L',
    fileName: ''
  },
  {
    id: '2',
    materialCode: 'MAT-CS-002',
    drawingNumber: 'DWG-002-B',
    filePath: '/drawings/carbon/dwg-002-b.pdf',
    pressure: '2.5MPa',
    volume: '1000L',
    fileName: ''
  },
  {
    id: '3',
    materialCode: 'MAT-VT-003',
    drawingNumber: 'DWG-003-C',
    filePath: '/drawings/vacuum/dwg-003-c.pdf',
    pressure: '0.1MPa',
    volume: '2000L',
    fileName: ''
  },
  {
    id: '4',
    materialCode: 'MAT-SS-004',
    drawingNumber: 'DWG-004-D',
    filePath: '/drawings/stainless/dwg-004-d.pdf',
    pressure: '1.0MPa',
    volume: '300L',
    fileName: ''
  },
  {
    id: '5',
    materialCode: 'MAT-CS-005',
    drawingNumber: 'DWG-005-E',
    filePath: '/drawings/carbon/dwg-005-e.pdf',
    pressure: '4.0MPa',
    volume: '5000L',
    fileName: ''
  },
  {
    id: '6',
    materialCode: 'MAT-VT-006',
    drawingNumber: 'DWG-006-F',
    filePath: '/drawings/vacuum/dwg-006-f.pdf',
    pressure: '0.05MPa',
    volume: '3000L',
    fileName: ''
  },
]

export const categories: DrawingCategory[] = ['不锈钢', '碳钢', '真空罐','卧式储气罐']
