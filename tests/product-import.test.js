import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseWorkbook,templateWorkbook} from '../product-import.js';

test('Excel template round-trips products, gallery and variants',async()=>{
  const bytes=await templateWorkbook();
  const data=await parseWorkbook(bytes);
  assert.equal(data.length,1);
  assert.equal(data[0].sku,'AKS-001');
  assert.deepEqual(data[0].specifications,{'Rang':'yashil','Material':'mato'});
  assert.deepEqual(data[0].variants.map(v=>v.label),['Yashil / kichik','Qizil / katta']);
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  book.getWorksheet('Mahsulotlar').getCell('M2').value='https://example.com/a.jpg | https://example.com/b.jpg';
  const updated=await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
  assert.deepEqual(updated[0].gallery,['https://example.com/a.jpg','https://example.com/b.jpg']);
});

test('bad variant association rejects the whole workbook',async()=>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(await templateWorkbook());
  book.getWorksheet('Variantlar').getCell('A2').value='BOSHQA-SKU';
  await assert.rejects(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer())),/mahsulot SKU topilmadi/);
});
