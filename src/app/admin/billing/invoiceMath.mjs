// Amount in Indian-English words for the invoice PDF.
export function words(n){
 const o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
 const w=x=>{x=Math.floor(x);if(!x)return '';if(x<20)return o[x];if(x<100)return t[Math.floor(x/10)]+(x%10?' '+o[x%10]:'');if(x<1000)return o[Math.floor(x/100)]+' Hundred'+(x%100?' '+w(x%100):'');if(x<1e5)return w(x/1e3)+' Thousand'+(x%1e3?' '+w(x%1e3):'');if(x<1e7)return w(x/1e5)+' Lakh'+(x%1e5?' '+w(x%1e5):'');return w(x/1e7)+' Crore'+(x%1e7?' '+w(x%1e7):'')};
 const paise=Math.round((n||0)*100),r=Math.floor(paise/100),p=paise%100; return 'INR '+(w(r)||'Zero')+' Rupees'+(p?' and '+w(p)+' Paise':'')+' Only';
}
// Line and invoice totals. type is 'IGST' or 'CGST_SGST'; the total is rounded to the rupee.
export function calc(items,type){
 let taxable=0,cgst=0,sgst=0,igst=0;
 const rows=items.map(x=>{const gross=+x.quantity*+x.unit_price,disc=gross*(+x.discount_percent||0)/100,tx=gross-disc,tax=tx*(+x.gst_rate||0)/100;taxable+=tx;if(type==='IGST')igst+=tax;else{cgst+=tax/2;sgst+=tax/2}return {...x,taxable_amount:tx,discount_amount:disc,line_total:tx+tax}});
 const tax=cgst+sgst+igst,total=taxable+tax,round=Math.round(total)-total;
 return {rows,taxable,cgst,sgst,igst,tax,round,total:total+round};
}
