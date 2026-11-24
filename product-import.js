import ExcelJS from 'exceljs';

export const PRODUCT_COLUMNS = ['sku','nomi','kategoriya','quyi_kategoriya','brend','narx','eski_narx','ombor','zaxira_turi','tolish_kuni','tavsif','rasm','galereya','xususiyatlar','karta_foni','sahifa_foni'];
export const VARIANT_COLUMNS = ['mahsulot_sku','nomi','sku','narx','ombor','rasm'];
const cell = value => value?.text ?? value?.result ?? (value?.hyperlink ? value.text : value) ?? '';
const field = value => String(cell(value)).trim();
const integer = value => value === '' ? 0 : Number(field(value));

export async function templateWorkbook() {
  const book = new ExcelJS.Workbook();
  book.creator = 'Marketuz';
  const products = book.addWorksheet('Mahsulotlar');
  products.addRow(PRODUCT_COLUMNS);
  products.addRow(['AKS-001','Namuna mahsulot','aksessuar','Sumkalar','',129000,149000,5,'tracked',7,'Haqiqiy tavsifni yozing','','','Rang: yashil | Material: mato','','']);
  const variants = book.addWorksheet('Variantlar');
  variants.addRow(VARIANT_COLUMNS);
  variants.addRow(['AKS-001','Yashil / kichik','AKS-001-Y',129000,3,'']);
  variants.addRow(['AKS-001','Qizil / katta','AKS-001-Q',139000,2,'']);
  for(const sheet of [products,variants]) {
    sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
    sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF12443B'}};
    sheet.columns.forEach(column=>column.width=21);
    sheet.views=[{state:'frozen',ySplit:1}];
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function parseWorkbook(bytes) {
  if(!Buffer.isBuffer(bytes) || bytes.length>1_200_000 || bytes.length<100) throw new Error('Excel fayl 1.2 MB dan kichik bo‘lsin. Rasmlarni faylga joylamang.');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet=book.getWorksheet('Mahsulotlar');
  if(!sheet) throw new Error('“Mahsulotlar” varag‘i topilmadi. Shablonni yuklab oling.');
  const headings=sheet.getRow(1).values.slice(1).map(field);
  if(PRODUCT_COLUMNS.some((h,i)=>headings[i]!==h)) throw new Error('Mahsulotlar ustunlari shablonga mos emas.');
  const raw=[];
  sheet.eachRow((row,n)=>{if(n>1 && row.values.slice(1).some(v=>field(v))) raw.push({line:n,values:PRODUCT_COLUMNS.map((_,i)=>field(row.getCell(i+1).value))});});
  if(!raw.length || raw.length>200) throw new Error('Bitta faylda 1 dan 200 tagacha mahsulot kiriting.');
  const products=raw.map(({line,values})=>{
    const [sku,name,category,subcategory,brand,price,oldPrice,stock,stockMode,restockDays,description,image,gallery,specs,cardBackground,detailBackground]=values;
    const specifications={}; for(const pair of specs.split('|').map(x=>x.trim()).filter(Boolean)) { const sep=pair.indexOf(':'); if(sep<1) throw new Error(`${line}-qatordagi xususiyatlar “Nomi: qiymat | Nomi: qiymat” ko‘rinishida bo‘lsin.`); specifications[pair.slice(0,sep).trim()]=pair.slice(sep+1).trim(); }
    return {line,sku,name,category,subcategory,brand,price:integer(price),oldPrice:integer(oldPrice),stock:integer(stock),stockMode:stockMode||'tracked',restockDays:integer(restockDays)||7,description,image,gallery:gallery.split('|').map(x=>x.trim()).filter(Boolean),specifications,cardBackground,detailBackground,externalLinks:[],variants:[]};
  });
  const skus=new Set();
  for(const p of products) { if(!p.sku) throw new Error(`${p.line}-qatorda SKU bo‘sh.`);if(skus.has(p.sku.toLowerCase()))throw new Error(`Takror SKU: ${p.sku}`);skus.add(p.sku.toLowerCase()); }
  const variantSheet=book.getWorksheet('Variantlar');
  if(variantSheet) {
    const headers=variantSheet.getRow(1).values.slice(1).map(field);
    if(VARIANT_COLUMNS.some((h,i)=>headers[i]!==h)) throw new Error('Variantlar ustunlari shablonga mos emas.');
    variantSheet.eachRow((row,n)=>{
      if(n===1) return;
      const [parent,label,sku,price,stock,image]=VARIANT_COLUMNS.map((_,i)=>field(row.getCell(i+1).value));
      if(![parent,label,sku,price,stock,image].some(Boolean))return;
      const p=products.find(item=>item.sku.toLowerCase()===parent.toLowerCase());
      if(!p)throw new Error(`Variantlar ${n}-qatorda mahsulot SKU topilmadi: ${parent}`);
      p.variants.push({label,sku,price:integer(price),stock:integer(stock),image});
    });
  }
  if(products.reduce((n,p)=>n+p.variants.length,0)>800)throw new Error('Variantlar ko‘pi bilan 800 ta bo‘lsin.');
  return products;
}
