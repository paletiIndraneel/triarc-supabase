// Amount in Indian-English words for the invoice PDF.
export function words(n){
 const o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
 const w=x=>{x=Math.floor(x);if(!x)return '';if(x<20)return o[x];if(x<100)return t[Math.floor(x/10)]+(x%10?' '+o[x%10]:'');if(x<1000)return o[Math.floor(x/100)]+' Hundred'+(x%100?' '+w(x%100):'');if(x<1e5)return w(x/1e3)+' Thousand'+(x%1e3?' '+w(x%1e3):'');if(x<1e7)return w(x/1e5)+' Lakh'+(x%1e5?' '+w(x%1e5):'');return w(x/1e7)+' Crore'+(x%1e7?' '+w(x%1e7):'')};
 const paise=Math.round((n||0)*100),r=Math.floor(paise/100),p=paise%100; return 'INR '+(w(r)||'Zero')+' Rupees'+(p?' and '+w(p)+' Paise':'')+' Only';
}
// The rate entered for an item includes GST, so the taxable value is taken out of it.
export function rateExGst(unitPrice,gstRate){return (+unitPrice||0)/(1+(+gstRate||0)/100)}
// Line and invoice totals. type is 'IGST' or 'CGST_SGST'; the total is rounded to the rupee.
// unit_price includes GST: a line costs quantity x rate (less discount), GST included.
export function calc(items,type){
 let taxable=0,cgst=0,sgst=0,igst=0;
 const rows=items.map(x=>{const gross=+x.quantity*+x.unit_price,disc=gross*(+x.discount_percent||0)/100,incl=gross-disc,tx=incl/(1+(+x.gst_rate||0)/100),tax=incl-tx;taxable+=tx;if(type==='IGST')igst+=tax;else{cgst+=tax/2;sgst+=tax/2}return {...x,taxable_amount:tx,discount_amount:disc,line_total:incl}});
 const tax=cgst+sgst+igst,total=taxable+tax,round=Math.round(total)-total;
 return {rows,taxable,cgst,sgst,igst,tax,round,total:total+round};
}
// Why a GSTIN is invalid, or null. Format plus the mod-36 check digit (15th character).
export function gstinError(gstin){
 const g=String(gstin||'').trim().toUpperCase();
 if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g))return 'GSTIN must look like 36AAAAA0000A1Z5: state code, PAN, entity number, Z, check digit.';
 const cs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';let sum=0;
 for(let i=0;i<14;i++){const v=cs.indexOf(g[i])*(i%2?2:1);sum+=Math.floor(v/36)+v%36}
 return cs[(36-sum%36)%36]===g[14]?null:'GSTIN check digit does not match. Check for a typo.';
}
// Lines for the same item at the same rate become one line with the quantities added.
export function mergeLines(items){
 const out=new Map();
 for(const x of items){const k=[x.inventory_id,x.description,x.hsn,x.unit,+x.unit_price,+x.gst_rate,+x.discount_percent||0].join('|'),prev=out.get(k);out.set(k,prev?{...prev,quantity:Math.round((+prev.quantity+ +x.quantity)*10000)/10000}:{...x})}
 return [...out.values()];
}
