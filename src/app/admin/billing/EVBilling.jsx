import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/billing';
import { useToast } from '@/components/BillingToast';
import { confirmDialog, promptDialog } from '@/components/admin/confirmDialog';
import { words, calc, gstinError, mergeLines } from './invoiceMath.mjs';

const TRIARC_STATE = '36';
const istToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const savedTax = inv => Number(inv.igst_amount||0)>0?'IGST':'CGST_SGST';
const taxLabel = t => t==='IGST'?'IGST':'CGST + SGST';
// GST state codes for the customer's billing state.
const GST_STATES=[['01','Jammu and Kashmir'],['02','Himachal Pradesh'],['03','Punjab'],['04','Chandigarh'],['05','Uttarakhand'],['06','Haryana'],['07','Delhi'],['08','Rajasthan'],['09','Uttar Pradesh'],['10','Bihar'],['11','Sikkim'],['12','Arunachal Pradesh'],['13','Nagaland'],['14','Manipur'],['15','Mizoram'],['16','Tripura'],['17','Meghalaya'],['18','Assam'],['19','West Bengal'],['20','Jharkhand'],['21','Odisha'],['22','Chhattisgarh'],['23','Madhya Pradesh'],['24','Gujarat'],['26','Dadra and Nagar Haveli and Daman and Diu'],['27','Maharashtra'],['29','Karnataka'],['30','Goa'],['31','Lakshadweep'],['32','Kerala'],['33','Tamil Nadu'],['34','Puducherry'],['35','Andaman and Nicobar Islands'],['36','Telangana'],['37','Andhra Pradesh'],['38','Ladakh'],['97','Other Territory']];
const money = n => Number(n || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-';
const gstState = g => g && /^\d{2}/.test(g.trim()) ? g.trim().slice(0,2) : null;

// jsPDF (~100 KB gzipped) is loaded only when a PDF is made, not with /admin.
async function pdf(inv,items,cfg){const { jsPDF } = await import('jspdf');
  // PDF layout rebuilt from the supplied Excel invoice template.
  // The printable area is A1:G37. Keep this function aligned to that template.
  const d=new jsPDF({unit:'mm',format:'a4'});
  const safe=v=>v===null||v===undefined?'':String(v);
  const money2=n=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money4=n=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:4,maximumFractionDigits:4});
  const company=inv.company_business_name?inv:(cfg||{});
  const addr=[
    company.company_address_line1||company.address_line1,
    company.company_address_line2||company.address_line2,
    company.company_city||company.city,
    company.company_state||company.state,
    company.company_pincode||company.pincode,
    company.company_country||company.country||'India'
  ].filter(Boolean).join(', ');
  const buyerAddr=[
    inv.billing_address_line1,inv.billing_address_line2,inv.billing_city,
    inv.billing_state,inv.billing_pincode,inv.billing_country||'India'
  ].filter(Boolean).join(', ').replace(/\s*\n\s*/g,', '); // the address box allows line breaks; the PDF wraps on its own
  const stateName=safe(inv.place_of_supply||inv.billing_state);
  const stateCode=safe(inv.billing_state_code||inv.place_of_supply_state_code);
  const isIgst=Number(inv.igst_amount||0)>0;
  const BLUE=[182,221,232];
  const L=10,TOP=5,W=190,R=L+W;
  const rowH={1:10,2:7,3:11,4:6,5:7,6:7,7:7,8:7,9:7,10:7,11:6.5,12:6.5,13:6.5,14:7,15:8,16:8,17:8,18:8,19:7,20:7,21:7,22:8,23:10,24:5,25:5,26:7,27:7,28:7,29:9,30:5,31:7,32:11,33:8,34:8,35:10,36:8,37:8};
  const y={};
  let yy=TOP;
  for(let r=1;r<=15;r++){y[r]=yy;yy+=rowH[r];}
  // Service rows (template rows 16-18) grow with the item count, minimum three,
  // and spill onto continuation pages. The summary block (rows 19-37) is never split.
  const ITEM_H=8,PAGE_END=292;
  let tailH=0;
  for(let r=19;r<=37;r++)tailH+=rowH[r];
  const slots=Math.max(3,items.length),pages=[];
  for(let i=0,start=y[15]+rowH[15];;start=TOP+rowH[15]){
    const remaining=slots-i;
    if(remaining*ITEM_H<=PAGE_END-tailH-start){pages.push({start,from:i,to:slots});break;}
    const take=Math.max(1,Math.min(remaining-1,Math.floor((PAGE_END-start)/ITEM_H)));
    pages.push({start,from:i,to:i+take});i+=take;
  }
  // Excel A:G column widths scaled to the 190 mm invoice frame.
  const cw=[11,31,11.86,12.86,16.57,10.43,19], scale=W/cw.reduce((a,b)=>a+b,0), x=[L];
  cw.forEach(w=>x.push(x[x.length-1]+w*scale));
  const line=()=>{d.setDrawColor(0);d.setLineWidth(.25);};
  const rect=(x1,y1,x2,y2)=>d.rect(x1,y1,x2-x1,y2-y1);
  const hline=(r)=>d.line(L,y[r]+rowH[r],R,y[r]+rowH[r]);
  const center=(txt,x1,x2,yy,size=8,bold=false)=>{d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.text(safe(txt),(x1+x2)/2,yy,{align:'center'});};
  const right=(txt,x1,x2,yy,size=8,bold=false)=>{d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.text(safe(txt),x2-1,yy,{align:'right'});};
  const left=(txt,x1,yy,size=8,bold=false,maxWidth)=>{d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.text(safe(txt),x1+1,yy,maxWidth?{maxWidth}:undefined);};

  // Outer invoice frame: one continuous, uniform border on all four sides of each page,
  // then the standard thinner weight for internal table/divider lines.
  const frame=(top,bot)=>{d.setDrawColor(0);d.setLineWidth(0.5);d.rect(L,top,W,bot-top);line();};
  line();

  // Header A1:G5
  d.setTextColor(255,0,0); center('Tax Invoice',L,R,y[1]+6.8,12,true); d.setTextColor(0,0,0);
  d.line(L,y[3]+rowH[3],R,y[3]+rowH[3]);
  d.line(L,y[4]+rowH[4],R,y[4]+rowH[4]);
  d.line(L,y[5]+rowH[5],R,y[5]+rowH[5]);
  center('M/s. '+(company.company_business_name||company.business_name||'TRIARC GROUP'),L,R,y[2]+5.2,13,true);
  center(addr,L+2,R-2,y[3]+7.0,7.4,false);
  center('GSTIN: '+(inv.company_gstin||company.company_gstin||cfg?.gstin||'36AAYFT2036P1ZB'),L,R,y[4]+4.5,8.2,true);
  left('Contact: '+(inv.company_phone||company.company_phone||cfg?.phone||'+91 7993356677'),L,y[5]+4.8,8);
  right('E-Mail: '+(inv.company_email||company.company_email||cfg?.email||'TRIARCGROUP9@GMAIL.COM'),L+95,R,y[5]+4.8,8);

  // Buyer / invoice metadata block A6:G14.
  d.line(x[4],y[6],x[4],y[14]+rowH[14]);
  // Invoice metadata rows are consecutive, matching the reference.
  // Invoice No. and Dated use the same row height as Invoice Period.
  d.line(x[5],y[6],x[5],y[9]);
  // Reference borders: Invoice Period, Invoice No., and Dated are
  // consecutive rows; Mode/Terms is one full-width field below them.
  d.line(x[4],y[6],R,y[6]);
  d.line(x[4],y[7],R,y[7]);
  d.line(x[4],y[8],R,y[8]);
  d.line(x[4],y[9],R,y[9]);
  d.line(L,y[14],R,y[14]);
  d.line(L,y[14]+rowH[14],R,y[14]+rowH[14]);
  left('Buyer (Bill to)',L,y[6]+5.0,9,true);
  left(inv.billing_name,L,y[7]+5.0,8.5);
  if(buyerAddr){
    // Keep the address inside the three address rows (8-10) without truncating it.
    // For longer addresses, progressively reduce the font size so all wrapped
    // lines remain visible before the State/GSTIN rows begin.
    const maxW=x[5]-L-3;
    let addressSize=7.6;
    let lines=d.splitTextToSize(buyerAddr,maxW);
    while(lines.length>3 && addressSize>5.8){
      addressSize-=0.3;
      d.setFont('helvetica','normal');
      d.setFontSize(addressSize);
      lines=d.splitTextToSize(buyerAddr,maxW);
    }
    lines.slice(0,3).forEach((t,i)=>left(t,L,y[8]+4.5+i*4.3,addressSize));
  }
  left('State Name: '+safe(inv.billing_state)+'   Code: '+stateCode,L,y[11]+4.6,7.6);
  left('GSTIN/UIN: '+safe(inv.billing_gstin),L,y[12]+4.6,7.6);
  left('Place of Supply: '+stateName+(inv.place_of_supply_state_code?' ('+safe(inv.place_of_supply_state_code)+')':''),L,y[13]+4.6,7.6);
  left('Station: '+safe(inv.station),L,y[14]+5.0,8.5);

  // Metadata is a narrow right-hand block in the reference. Keep labels and values
  // separated so the long invoice-period value never overlaps its label.
  // Center each metadata label/value pair within its respective cell.
  center('Invoice Period :',x[4],x[5],y[6]+rowH[6]/2+2.7,7.3,true);
  center(fmtDate(inv.billing_period_from)+' - '+fmtDate(inv.billing_period_to),x[5],R,y[6]+rowH[6]/2+2.7,6.5);
  center('Invoice No :',x[4],x[5],y[7]+rowH[7]/2+2.7,8.2,true);
  center(inv.invoice_number,x[5],R,y[7]+rowH[7]/2+2.7,7.5);
  center('Dated :',x[4],x[5],y[8]+rowH[8]/2+2.7,8.2,true);
  center(fmtDate(inv.invoice_date),x[5],R,y[8]+rowH[8]/2+2.7,7.5);
  left('Mode/Terms of Payment:',x[4],y[9]+5.0,7.2,false);

  // Service table A15:G18, repeated with its header on each continuation page.
  const headers=['Sl No.','Description of Services','GST Rate','Quantity (kWh)','Rate (Rs.)','per','Amount (Rs.)'];
  let pageTop=TOP,itemEnd;
  pages.forEach((p,n)=>{
    if(n){frame(pageTop,itemEnd);d.addPage();pageTop=TOP;}
    const head=p.start-rowH[15];
    itemEnd=p.start+(p.to-p.from)*ITEM_H;
    d.setFillColor(...BLUE);d.rect(L+0.25,head,W-0.5,rowH[15],'F');
    d.line(L,head,R,head);d.line(L,p.start,R,p.start);
    for(let i=0;i<8;i++)d.line(x[i],head,x[i],itemEnd);
    headers.forEach((v,i)=>center(v,x[i],x[i+1],head+5.3,7.3,true));
    for(let i=p.from;i<p.to;i++){
      const top=p.start+(i-p.from)*ITEM_H, item=items[i]||{};
      const desc=item.description ? item.description+' (HSN/SAC '+safe(item.hsn||'996749')+')' : '';
      d.line(L,top+ITEM_H,R,top+ITEM_H);
      center(i+1,x[0],x[1],top+5.2,7.3);
      left(desc,x[1],top+5.2,7.0,false,x[2]-x[1]-2);
      center(item.gst_rate!==undefined&&item.gst_rate!=='' ? (+item.gst_rate||0)+'%' : '',x[2],x[3],top+5.2,7.2);
      right(item.quantity===undefined?'':money4(item.quantity),x[3],x[4],top+5.2,7.2);
      right(item.unit_price===undefined?'':money4(item.unit_price),x[4],x[5],top+5.2,7.2);
      center(item.unit||'UNT',x[5],x[6],top+5.2,7.2);
      right(item.taxable_amount===undefined?'':money2(item.taxable_amount),x[6],x[7],top+5.2,7.2);
    }
  });
  yy=itemEnd;
  for(let r=19;r<=37;r++){y[r]=yy;yy+=rowH[r];}
  const bottom=y[37]+rowH[37];

  // Summary rows A19:G23. The reference has no horizontal separators
  // through the label area; only the amount/value column is divided.
  for(let r=19;r<=21;r++){d.line(x[6],y[r],R,y[r]);}
  d.line(x[6],y[21]+rowH[21],R,y[21]+rowH[21]);
  // Continue the summary divider from Rounding Off through the Total
  // amount row, ending at the Rs. grand-total boundary.
  d.line(x[6],y[19],x[6],y[22]+rowH[22]);
  [19,20,21].forEach(r=>right(
    r===19?'Sub Total (Taxable Value)':r===20?(isIgst?'IGST Output A/c @ '+(items[0]?.gst_rate||0)+'%':'CGST + SGST'):'Rounding Off',
    L,x[6],y[r]+4.7,7.5,r===19
  ));
  right(money2(inv.taxable_amount),x[6],R,y[19]+4.7,7.5,true);
  right(money2(isIgst?inv.igst_amount:(Number(inv.cgst_amount||0)+Number(inv.sgst_amount||0))),x[6],R,y[20]+4.7,7.5);
  right(money2(inv.round_off),x[6],R,y[21]+4.7,7.5);

  d.setFillColor(...BLUE);d.rect(L+0.25,y[22],W-0.5,rowH[22],'F');
  d.line(L,y[22],R,y[22]);d.line(L,y[22]+rowH[22],R,y[22]+rowH[22]);
  // Redraw the summary amount divider over the blue Total fill so the
  // Rounding Off / value boundary continues uninterrupted into Total.
  d.setDrawColor(0);d.setLineWidth(0.25);
  d.line(x[6],y[22],x[6],y[22]+rowH[22]);
  line();
  // Reference Total row: retain both service-table-aligned vertical boundaries:
  // GST Rate / Quantity and Quantity / Rate.
  d.line(x[3],y[22],x[3],y[22]+rowH[22]);
  d.line(x[4],y[22],x[4],y[22]+rowH[22]);
  center('Total',L,x[3],y[22]+5.3,8,true);
  right(money4(items.reduce((n,r)=>n+(+r.quantity||0),0)),x[3],x[4],y[22]+5.3,7.5,true);
  right('Rs. '+money2(inv.grand_total),x[4],R,y[22]+5.3,8,true);

  left('Amount Chargeable (in words): '+words(inv.grand_total)+' (E. & O.E.)',L,y[23]+6.2,7.5,true,R-L-2);

  // Tax analysis A25:G29.
  // Keep the Tax Analysis blue fill strictly inside the outer black frame.
  d.setFillColor(...BLUE);
  d.rect(L+0.25,y[25]+0.25,W-0.5,rowH[25]-0.5,'F');
  d.setDrawColor(0);
  d.setLineWidth(0.5);
  d.line(L,y[25],R,y[25]);
  d.line(L,y[25]+rowH[25],R,y[25]+rowH[25]);
  line();
  // Center the heading within the Tax Analysis header row itself,
  // using the row's top and bottom boundaries rather than a fixed offset.
  center('Tax Analysis',L,R,y[25]+rowH[25]/2+1.2,9,true);
  for(let r=26;r<=28;r++)hline(r);
  const txCols=isIgst ? [L,x[2],x[3],x[4],x[6],R] : [L,x[2],x[3],x[4],x[5],x[6],R];
  txCols.forEach(xx=>d.line(xx,y[26],xx,y[28]+rowH[28]));
  const txHeaders=isIgst?['HSN/SAC','Taxable Value','IGST Rate','IGST Amount','Total Tax Amount']:['HSN/SAC','Taxable Value','GST Rate','CGST','SGST','Total Tax Amount'];
  txHeaders.forEach((v,i)=>center(v,txCols[i],txCols[i+1],y[26]+5.0,7.0,true));
  const groups={};
  items.forEach(item=>{const h=item.hsn||'996749';const g=groups[h]||(groups[h]={taxable:0,gst:+item.gst_rate||0});g.taxable+=+item.taxable_amount||0;});
  const first=Object.entries(groups)[0]||['996749',{taxable:Number(inv.taxable_amount||0),gst:+items[0]?.gst_rate||18}];
  const taxValue=Number(inv.taxable_amount||first[1].taxable||0), rate=first[1].gst||18;
  center(first[0],txCols[0],txCols[1],y[27]+5.0,7.0);
  right(money2(taxValue),txCols[1],txCols[2],y[27]+5.0,7.0);
  center(rate+'%',txCols[2],txCols[3],y[27]+5.0,7.0);
  if(isIgst){
    right(money2(inv.igst_amount),txCols[3],txCols[4],y[27]+5.0,7.0);
    right(money2(inv.igst_amount),txCols[4],txCols[5],y[27]+5.0,7.0);
  }else{
    right(money2(inv.cgst_amount),txCols[3],txCols[4],y[27]+5.0,7.0);
    right(money2(inv.sgst_amount),txCols[4],txCols[5],y[27]+5.0,7.0);
    right(money2(inv.total_tax),txCols[5],txCols[6],y[27]+5.0,7.0);
  }
  center('Total',txCols[0],txCols[1],y[28]+5.0,7.0,true);
  right(money2(taxValue),txCols[1],txCols[2],y[28]+5.0,7.0,true);
  if(isIgst){
    right(money2(inv.igst_amount),txCols[3],txCols[4],y[28]+5.0,7.0,true);
    right(money2(inv.igst_amount),txCols[4],txCols[5],y[28]+5.0,7.0,true);
  }else{
    right(money2(inv.cgst_amount),txCols[3],txCols[4],y[28]+5.0,7.0,true);
    right(money2(inv.sgst_amount),txCols[4],txCols[5],y[28]+5.0,7.0,true);
    right(money2(inv.total_tax),txCols[5],txCols[6],y[28]+5.0,7.0,true);
  }

  left('Tax Amount (in words): '+words(inv.total_tax),L,y[29]+6.0,7.5,true,R-L-2);

  left('Declaration',L,y[31]+5.0,8.5,true);
  left('We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.',L,y[32]+5.0,7.2,false,R-L-2);

  left("Customer's Seal and Signature",L,y[35]+6.0,7.2);
  right('for M/s. '+(inv.company_business_name||company.company_business_name||company.business_name||'TRIARC GROUP'),L+100,R,y[35]+6.0,7.2,true);
  center('This is a Computer Generated Invoice',L,R,y[37]+5.5,7.2);
  right('Authorised Signatory',L+120,R,y[37]+5.5,7.2);

  frame(pageTop,bottom);
  // Cancelled invoices stay downloadable but are stamped on every page.
  if(inv.invoice_status==='cancelled'){for(let n=1;n<=d.getNumberOfPages();n++){d.setPage(n);d.setGState(new d.GState({opacity:0.18}));d.setTextColor(201,42,42);d.setFont('helvetica','bold');d.setFontSize(64);d.text('CANCELLED',105,170,{align:'center',angle:30});d.setGState(new d.GState({opacity:1}));}d.setTextColor(0);}
  return d;
}
export const INVOICE_STATUSES=[['draft','Draft'],['issued','Generated'],['sent','Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['cancelled','Cancelled']];
export const STATUS_COLORS={draft:['#f1f3f5','#495057'],issued:['#e7f0ff','#1c5bd8'],sent:['#efe9ff','#6741d9'],partially_paid:['#fff4e0','#b35c00'],paid:['#e6f7ec','#1e7b3c'],cancelled:['#fdecec','#c92a2a']};
const statusLabel=v=>(INVOICE_STATUSES.find(x=>x[0]===v)||[,v||'-'])[1];
// Native <dialog>: Escape, focus kept inside, background inert and announced as a dialog.
function Modal({title,children,onClose}){
 const ref=useRef(null),titleId=useId(),downOnBackdrop=useRef(false);
 useEffect(()=>{const d=ref.current,opener=document.activeElement;d.showModal();d.querySelector('input,select,textarea')?.focus();return()=>{if(d.open)d.close();opener?.focus?.()}},[]);
 // Close on a backdrop click only when the press also started there (not a text drag that ends outside).
 return <dialog ref={ref} className="modal-card" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose()}} onMouseDown={e=>{downOnBackdrop.current=e.target===e.currentTarget}} onClick={e=>{if(downOnBackdrop.current&&e.target===e.currentTarget)onClose()}}><div className="modal-body"><div className="modal-header"><h3 id={titleId}>{title}</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18}/></button></div>{children}</div></dialog>;
}

export default function EVBilling(){
 const toast=useToast(),[tab,setTab]=useState('overview'),[customers,setCustomers]=useState([]),[inventory,setInventory]=useState([]),[invoices,setInvoices]=useState([]),[billingLines,setBillingLines]=useState([]),[settings,setSettings]=useState(null);
 const [customer,setCustomer]=useState(''),[station,setStation]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[manualTax,setManualTax]=useState('CGST_SGST'),[items,setItems]=useState([]),[saving,setSaving]=useState(false),[editingInvoice,setEditingInvoice]=useState(null),[fieldError,setFieldError]=useState(null);
 const [customerModal,setCustomerModal]=useState(false),[inventoryModal,setInventoryModal]=useState(false),[stationModal,setStationModal]=useState(false),[customerSaving,setCustomerSaving]=useState(false),[stationSaving,setStationSaving]=useState(false),[inventorySaving,setInventorySaving]=useState(false),[editingCustomer,setEditingCustomer]=useState(null),[editingInventory,setEditingInventory]=useState(null),[stations,setStations]=useState([]),[place,setPlace]=useState(''),[placeCode,setPlaceCode]=useState('');
 const [stationName,setStationName]=useState(''),[placeName,setPlaceName]=useState(''),[placeStateCode,setPlaceStateCode]=useState('');
 // Place of supply comes from the station record; an edited invoice keeps the text it was saved with.
 const pickStation=s=>{setStation(s?.name||'');setPlace(s?.place_of_supply||'');setPlaceCode(s?.state_code||'')};
 // Series comes from billing_invoice_settings; an edited invoice keeps its own.
 const series=editingInvoice?editingInvoice.invoice_series||'':settings?.series||'';
 const invoiceDate=editingInvoice?editingInvoice.invoice_date:istToday();
 const emptyCustomerForm={name:'',gstin:'',pan:'',billing_address_line1:'',billing_city:'',billing_state:'',billing_pincode:'',customer_state_code:''};
 const [customerForm,setCustomerForm]=useState(emptyCustomerForm);
 const emptyInventoryForm={product_name:'',hsn:'996749',unit:'KWH',purchase_price:'',selling_price:'',gst_rate:'18',notes:'',inventory_type:'electricity'}; const [inventoryForm,setInventoryForm]=useState(emptyInventoryForm);
 const load=useCallback(async()=>{const [a,b,c,s,st,li]=await Promise.all([supabase.from('billing_customers').select('*').eq('active',true).order('name'),supabase.from('billing_invoices').select('*').order('invoice_date',{ascending:false}),supabase.from('billing_inventory').select('*').eq('active',true).eq('inventory_type','electricity').order('product_name'),supabase.from('billing_invoice_settings').select('*').limit(1).maybeSingle(),supabase.from('billing_invoice_stations').select('*').eq('active',true).order('name'),supabase.from('billing_items').select('invoice_id,quantity')]);const err=[a,b,c,s,st,li].find(x=>x.error);if(err)throw err.error;setCustomers(a.data||[]);setInvoices(b.data||[]);setInventory(c.data||[]);setBillingLines(li.data||[]);setSettings(s.data);setStations(st.data||[]);if(st.data?.length)setStation(v=>{if(v)return v;setPlace(st.data[0].place_of_supply||'');setPlaceCode(st.data[0].state_code||'');return st.data[0].name})},[]);
 useEffect(()=>{load().catch(e=>toast.error(e.message))},[load,toast]); // An edited invoice keeps its saved tax type; only a new one follows the GSTIN.
 const c=customers.find(x=>x.id===customer),auto=gstState(c?.gstin),autoTax=auto?(auto===TRIARC_STATE?'CGST_SGST':'IGST'):null,taxType=editingInvoice||!autoTax?manualTax:autoTax,total=useMemo(()=>calc(items,taxType),[items,taxType]);
 const add=()=>{const p=inventory.find(p=>!items.some(x=>x.inventory_id===p.id))||inventory[0];if(!p)return toast.error('Add an inventory item first.');setItems(x=>[...x,{inventory_id:p.id,description:p.product_name,hsn:p.hsn||'',unit:p.unit||'PCS',quantity:1,unit_price:+p.selling_price||0,gst_rate:+p.gst_rate||0,discount_percent:0}])};
 const pick=(i,id)=>{const p=inventory.find(x=>x.id===id);if(!p)return;setItems(x=>x.map((r,n)=>n===i?{...r,inventory_id:p.id,description:p.product_name,hsn:p.hsn||'',unit:p.unit||'PCS',unit_price:+p.selling_price||0,gst_rate:+p.gst_rate||0}:r))};
 const openCustomer=(row=null)=>{setEditingCustomer(row);setCustomerForm(row?{name:row.name||'',gstin:row.gstin||'',pan:row.pan||'',billing_address_line1:row.billing_address_line1||'',billing_city:row.billing_city||'',billing_state:row.billing_state||'',billing_pincode:row.billing_pincode||'',customer_state_code:row.customer_state_code||''}:emptyCustomerForm);setCustomerModal(true)};
 const saveStation=async ev=>{ev.preventDefault();const name=stationName.trim(),pos=placeName.trim(),code=placeStateCode.trim();if(!name)return toast.error('Enter station name.');if(!pos||!/^\d{2}$/.test(code))return toast.error('Enter the place of supply text and its 2-digit state code.');setStationSaving(true);try{const {data,error}=await supabase.from('billing_invoice_stations').insert({name,place_of_supply:pos,state_code:code,active:true}).select().single();if(error)throw error;setStations(x=>[...x,data].sort((a,b)=>a.name.localeCompare(b.name)));pickStation(data);setStationName('');setPlaceName('');setPlaceStateCode('');setStationModal(false);toast.success('Station added')}catch(e){toast.error(e.message||'Station creation failed')}finally{setStationSaving(false)}};
 const openInventory=(row=null)=>{setEditingInventory(row);if(row){setInventoryForm({product_name:row.product_name||'',hsn:'996749',unit:'KWH',purchase_price:row.purchase_price??'',selling_price:row.selling_price??'',gst_rate:row.gst_rate??'18',notes:row.notes||'',inventory_type:'electricity'});}else{setInventoryForm(emptyInventoryForm);}setInventoryModal(true)};
 const addCustomer=async e=>{e.preventDefault();if(!customerForm.name.trim())return toast.error('Enter customer name.');const normalizedGstin=customerForm.gstin.replace(/\s+/g,'').toUpperCase(),pan=customerForm.pan.trim().toUpperCase()||normalizedGstin.slice(2,12),code=customerForm.customer_state_code.trim()||gstState(normalizedGstin)||GST_STATES.find(x=>x[1]===customerForm.billing_state)?.[0]||'';
 // GST type is derived from these, so a mismatch would put the wrong tax on every invoice.
 if(normalizedGstin){const ge=gstinError(normalizedGstin);if(ge)return toast.error(ge);if(code!==gstState(normalizedGstin))return toast.error('State code '+code+' does not match the GSTIN, which starts with '+gstState(normalizedGstin)+'.');if(pan!==normalizedGstin.slice(2,12))return toast.error('PAN '+pan+' does not match the PAN inside the GSTIN ('+normalizedGstin.slice(2,12)+').');}
 if(pan&&!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))return toast.error('PAN must look like AAAAA0000A.');
 {const st=GST_STATES.find(x=>x[1]===customerForm.billing_state);if(st&&code&&st[0]!==code)return toast.error('State '+st[1]+' ('+st[0]+') does not match the customer state code '+code+'.');}
 setCustomerSaving(true);try{const payload={customer_type:'business',name:customerForm.name.trim(),gstin:normalizedGstin||null,pan:pan||null,billing_address_line1:customerForm.billing_address_line1.trim()||null,billing_city:customerForm.billing_city.trim()||null,billing_state:customerForm.billing_state.trim()||null,billing_pincode:customerForm.billing_pincode.trim()||null,customer_state_code:code||null,active:true};const query=editingCustomer?supabase.from('billing_customers').update(payload).eq('id',editingCustomer.id):supabase.from('billing_customers').insert(payload);const {data,error}=await query.select().single();if(error)throw error;setCustomers(x=>{const next=editingCustomer?x.map(r=>r.id===data.id?data:r):[...x,data];return next.sort((a,b)=>a.name.localeCompare(b.name))});setCustomer(data.id);setCustomerModal(false);setCustomerForm(emptyCustomerForm);setEditingCustomer(null);toast.success(editingCustomer?'Customer updated':'Customer added')}catch(e){toast.error(e.message||'Customer creation failed')}finally{setCustomerSaving(false)}};
 const addInventory=async e=>{e.preventDefault();const itemName=inventoryForm.product_name.trim();if(!itemName)return toast.error('Enter item name.');if(inventory.some(r=>r.id!==editingInventory?.id&&r.product_name.trim().toLowerCase()===itemName.toLowerCase()))return toast.error('A billing item named '+itemName+' already exists. Edit that one or use a different name.');if(!inventoryForm.selling_price || +inventoryForm.selling_price<0)return toast.error('Enter a valid rate.');if(inventoryForm.gst_rate==='' || +inventoryForm.gst_rate<0)return toast.error('Enter a valid GST rate.');setInventorySaving(true);try{const payload={product_name:itemName,hsn:'996749',unit:'KWH',purchase_price:inventoryForm.purchase_price===''?null:+inventoryForm.purchase_price,selling_price:+inventoryForm.selling_price,gst_rate:+inventoryForm.gst_rate,stock_tracked:false,stock_qty:0,min_stock_qty:0,batch_no:null,expiry_date:null,supplier_name:null,notes:inventoryForm.notes.trim()||null,inventory_type:'electricity',active:true};const query=editingInventory?supabase.from('billing_inventory').update(payload).eq('id',editingInventory.id):supabase.from('billing_inventory').insert(payload);const {data,error}=await query.select().single();if(error)throw error;setInventory(x=>{const next=editingInventory?x.map(r=>r.id===data.id?data:r):[...x,data];return next.sort((a,b)=>a.product_name.localeCompare(b.product_name))});setInventoryModal(false);setInventoryForm(emptyInventoryForm);setEditingInventory(null);toast.success(editingInventory?'Billing item updated':'Billing item added');if(!items.length)setItems([{inventory_id:data.id,description:data.product_name,hsn:data.hsn||'',unit:data.unit||'KWH',quantity:1,unit_price:+data.selling_price||0,gst_rate:+data.gst_rate||0,discount_percent:0}]);}catch(e){toast.error(e.message||'Billing item creation failed')}finally{setInventorySaving(false)}};
 const openEditInvoice=async inv=>{try{const {data:rows,error}=await supabase.from('billing_items').select('*').eq('invoice_id',inv.id).order('created_at');if(error)throw error;setEditingInvoice(inv);setCustomer(inv.customer_id||'');setStation(inv.station||'');setPlace(inv.place_of_supply||'');setPlaceCode(inv.place_of_supply_state_code||'');setFrom(inv.billing_period_from||'');setTo(inv.billing_period_to||'');setManualTax(savedTax(inv));setItems((rows||[]).map(x=>({inventory_id:x.inventory_id,description:x.description,hsn:x.hsn||'',unit:x.unit||'KWH',quantity:x.quantity,unit_price:x.unit_price,gst_rate:x.gst_rate,discount_percent:x.discount_percent||0})));setTab('new');}catch(e){toast.error(e.message||'Unable to load invoice for editing')}};
 // An old free-text state stays selectable so editing a customer doesn't drop it.
 const stateSelect=(value,set)=><select value={value} onChange={e=>set(e.target.value)}><option value="">Select state</option>{value&&!GST_STATES.some(x=>x[1]===value)&&<option value={value}>{value}</option>}{GST_STATES.map(([code,name])=><option value={name} key={code}>{name} ({code})</option>)}</select>;
 // One inline error at a time, on the first field that needs attention.
 const clearErr=f=>setFieldError(e=>e&&e[0]===f?null:e);
 const errText=f=>fieldError?.[0]===f?<span className="field-error" role="alert">{fieldError[1]}</span>:null;
 const validate=()=>{if(!c)return['customer','Select a customer.'];if(!station.trim())return['station','Select the charging station.'];if(!place.trim()||!placeCode)return['station','This station has no place of supply. Set place_of_supply and state_code on it in billing_invoice_stations.'];if(!from)return['from','Pick the first day of the billing period.'];if(!to)return['to','Pick the last day of the billing period.'];if(new Date(from)>new Date(to))return['to','Pick a date on or after the start date.'];if(to>invoiceDate)return['to','The period must end on or before the invoice date, '+fmtDate(invoiceDate)+'.'];if(!editingInvoice&&!series.trim())return['series','Set the invoice series in invoice settings first.'];if(!items.length)return['items','Add at least one line.'];const bad=items.findIndex(x=>!String(x.description||'').trim()||!(+x.quantity>0)||!(+x.unit_price>=0));if(bad>=0)return['items','Line '+(bad+1)+': enter a quantity above 0 and a valid rate.'];return null};
 const save=async()=>{const v=validate();if(v){setFieldError(v);document.querySelector('[data-field="'+v[0]+'"]')?.scrollIntoView({block:'center',behavior:'smooth'});return}setFieldError(null);if(editingInvoice&&taxType!==savedTax(editingInvoice)&&!(await confirmDialog({title:'Change tax type?',message:'Change '+editingInvoice.invoice_number+' from '+taxLabel(savedTax(editingInvoice))+' to '+taxLabel(taxType)+'? This changes the tax on an issued invoice.',confirmLabel:'Change tax',danger:true})))return;const total=calc(mergeLines(items),taxType);setSaving(true);try{const invoiceNumber=editingInvoice?editingInvoice.invoice_number:(await supabase.rpc('next_billing_invoice_number',{p_series:series.trim()})).data;if(!invoiceNumber)throw new Error('Unable to determine invoice number.');const {data:u}=await supabase.auth.getUser();const base={invoice_number:invoiceNumber,invoice_series:editingInvoice?editingInvoice.invoice_series:series.trim(),invoice_date:invoiceDate,customer_id:c.id,billing_name:c.name,billing_gstin:c.gstin||null,billing_pan:c.pan||null,billing_address_line1:c.billing_address_line1,billing_address_line2:c.billing_address_line2,billing_city:c.billing_city,billing_state:c.billing_state,billing_state_code:c.customer_state_code||gstState(c.gstin),billing_pincode:c.billing_pincode,billing_country:c.billing_country||'India',place_of_supply:place.trim(),place_of_supply_state_code:placeCode||c.customer_state_code||gstState(c.gstin),station:station.trim(),billing_period_from:from,billing_period_to:to,subtotal:total.taxable,discount_total:0,taxable_amount:total.taxable,cgst_amount:total.cgst,sgst_amount:total.sgst,igst_amount:total.igst,cess_amount:0,total_tax:total.tax,round_off:total.round,grand_total:total.total,};if(!editingInvoice){base.invoice_status='issued';base.company_business_name=settings?.business_name||null;base.company_legal_name=settings?.legal_name||null;base.company_gstin=settings?.gstin||null;base.company_pan=settings?.pan||null;base.company_address_line1=settings?.address_line1||null;base.company_address_line2=settings?.address_line2||null;base.company_city=settings?.city||null;base.company_state=settings?.state||null;base.company_state_code=settings?.state_code||null;base.company_pincode=settings?.pincode||null;base.company_country=settings?.country||'India';base.company_phone=settings?.phone||null;base.company_email=settings?.email||null;base.company_website=settings?.website||null;base.created_by=u.user?.id||null;}const rows=total.rows.map(x=>({inventory_id:x.inventory_id,description:x.description,hsn:x.hsn||null,unit:x.unit,quantity:+x.quantity,unit_price:+x.unit_price,discount_percent:+x.discount_percent||0,discount_amount:x.discount_amount,taxable_amount:x.taxable_amount,gst_rate:+x.gst_rate,cgst_rate:taxType==='CGST_SGST'?+x.gst_rate/2:0,cgst_amount:taxType==='CGST_SGST'?x.taxable_amount*+x.gst_rate/200:0,sgst_rate:taxType==='CGST_SGST'?+x.gst_rate/2:0,sgst_amount:taxType==='CGST_SGST'?x.taxable_amount*+x.gst_rate/200:0,igst_rate:taxType==='IGST'?+x.gst_rate:0,igst_amount:taxType==='IGST'?x.taxable_amount*+x.gst_rate/100:0,cess_rate:0,cess_amount:0,line_total:x.line_total,tax_type:taxType}));// One transaction: a failed item insert can no longer leave the invoice without items.const {data:res,error:se}=await supabase.rpc('save_billing_invoice',{p_invoice_id:editingInvoice?.id||null,p_invoice:editingInvoice?base:{...base,created_by:u.user?.id||null},p_items:rows});if(se)throw se;const {invoice:inv,items:saved}=res;setInvoices(x=>[inv,...x.filter(r=>r.id!==inv.id)]);setBillingLines(x=>[...x.filter(l=>l.invoice_id!==inv.id),...saved.map(l=>({invoice_id:inv.id,quantity:l.quantity}))]);setItems([]);setCustomer('');setStation('');setPlace('');setPlaceCode('');setFrom('');setTo('');setEditingInvoice(null);setTab('invoices');toast.success(editingInvoice?'Billing invoice updated':'Billing invoice created');(await pdf(inv,saved,settings)).save(inv.invoice_number+'.pdf');}catch(e){toast.error(e.message||'Invoice save failed')}finally{setSaving(false)}};
 const download=async inv=>{const [{data:i,error:ie}]=await Promise.all([supabase.from('billing_items').select('*').eq('invoice_id',inv.id).order('created_at')]);if(ie)return toast.error(ie.message);(await pdf(inv,i,settings)).save(inv.invoice_number+'.pdf')};
 // Invoices are never deleted, so a number can't be handed out twice; cancel them instead.
 // Billing is partner-only, so partners may reopen a cancelled invoice; Paid, Cancelled and reopening ask first.
 const setInvoiceStatus=async(inv,status)=>{if(status===inv.invoice_status)return;if(inv.invoice_status==='cancelled'&&!(await confirmDialog({title:'Reopen invoice?',message:'Reopen cancelled invoice '+inv.invoice_number+' as '+statusLabel(status)+'? It will count in the totals again.',confirmLabel:'Reopen'})))return;if(status==='cancelled'&&!(await confirmDialog({title:'Cancel invoice?',message:'Cancel invoice '+inv.invoice_number+'? It stays on record marked CANCELLED, and its number is not reused.',confirmLabel:'Cancel invoice',cancelLabel:'Keep invoice',danger:true})))return;if(status==='paid'&&!(await confirmDialog({title:'Mark as paid?',message:'Mark invoice '+inv.invoice_number+' as Paid?',confirmLabel:'Mark paid'})))return;const patch={invoice_status:status};const total=Number(inv.grand_total||0);if(status==='paid')patch.amount_paid=total;else if(status==='partially_paid'){const got=await promptDialog({title:'Partially paid',message:'Amount received so far for '+inv.invoice_number+' (total ₹'+total.toFixed(2)+')',defaultValue:String(Number(inv.amount_paid||0)||''),inputMode:'decimal',confirmLabel:'Save'});if(got===null)return;const amt=Number(got);if(!Number.isFinite(amt)||amt<=0||amt>=total)return toast.error('Enter an amount above 0 and below the invoice total.');patch.amount_paid=Math.round(amt*100)/100}else if(status!=='cancelled')patch.amount_paid=0;const {data,error}=await supabase.from('billing_invoices').update(patch).eq('id',inv.id).select().single();if(error)return toast.error(error.message);setInvoices(x=>x.map(r=>r.id===inv.id?data:r));toast.success('Invoice '+inv.invoice_number+' marked '+statusLabel(status))};
 const deleteCustomer=async row=>{if(!(await confirmDialog({title:'Delete customer?',message:'Delete customer '+row.name+'? This cannot be undone.',confirmLabel:'Delete',danger:true})))return;const {count,error:ce}=await supabase.from('billing_invoices').select('id',{count:'exact',head:true}).eq('customer_id',row.id);if(ce)return toast.error(ce.message);if(count)return toast.error('Customer cannot be deleted because invoices exist for this customer.');const {error}=await supabase.from('billing_customers').delete().eq('id',row.id);if(error)return toast.error(error.message);setCustomers(x=>x.filter(r=>r.id!==row.id));toast.success('Customer deleted')};
 const deleteInventory=async row=>{if(!(await confirmDialog({title:'Delete billing item?',message:'Delete billing item '+row.product_name+'? This cannot be undone.',confirmLabel:'Delete',danger:true})))return;const {count,error:ce}=await supabase.from('billing_items').select('id',{count:'exact',head:true}).eq('inventory_id',row.id);if(ce)return toast.error(ce.message);if(count)return toast.error('Billing item cannot be deleted because it is used on invoices. Deactivate it instead.');const {error}=await supabase.from('billing_inventory').delete().eq('id',row.id);if(error)return toast.error(error.message);setInventory(x=>x.filter(r=>r.id!==row.id));toast.success('Charging item deleted')};
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
 return <div className="billing-app">
<main className="billing-main">
    <div className="billing-heading"><div><h1>Billing</h1><p>Manage EV charging invoices, customers, and billable services.</p></div><div className="heading-actions"><button className="btn btn-primary" onClick={()=>setTab('new')}><Plus size={14}/> New Bill</button></div></div>
    <div className="billing-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='invoices'?'active':''} onClick={()=>setTab('invoices')}>Invoices</button><button className={tab==='customers'?'active':''} onClick={()=>setTab('customers')}>Customers &amp; Accounts</button><button className={tab==='billing-items'?'active':''} onClick={()=>setTab('billing-items')}>Billing Items</button></div>
    {tab==='overview'&&(()=>{const live=invoices.filter(x=>x.invoice_status!=='cancelled'),liveIds=new Set(live.map(x=>x.id));return <div className="billing-overview"><div className="billing-kpis"><div className="billing-kpi"><span>Total Billed Amount</span><strong>₹{money(live.reduce((a,x)=>a+Number(x.grand_total||0),0))}</strong></div><div className="billing-kpi"><span>Invoice Count</span><strong>{live.length.toLocaleString('en-IN')}</strong></div><div className="billing-kpi"><span>Total Energy Billed</span><strong>{billingLines.filter(x=>liveIds.has(x.invoice_id)).reduce((a,x)=>a+Number(x.quantity||0),0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} kWh</strong></div><div className="billing-kpi"><span>Total GST Billed</span><strong>₹{money(live.reduce((a,x)=>a+Number(x.total_tax||0),0))}</strong></div></div><section className="billing-card"><div className="section-head"><div><h2>Recent Invoices</h2><p>Latest EV charging invoices. Cancelled invoices are left out, as in the totals.</p></div><button className="link-button" onClick={()=>setTab('invoices')}>View all invoices</button></div><div className="table-container"><table><thead><tr><th>Invoice No. &amp; Series</th><th>Customer / Billed To</th><th>Charging Station / Hub</th><th>Billing Period</th><th>Taxable Amount</th><th>Total GST</th><th>Grand Total</th></tr></thead><tbody>{live.slice(0,6).map(i=><tr key={i.id}><td><b>{i.invoice_number}</b><small>{i.invoice_series||'-'}</small></td><td>{i.billing_name||'-'}</td><td>{i.station||'-'}</td><td>{fmtDate(i.billing_period_from)} - {fmtDate(i.billing_period_to)}</td><td>₹{money(i.taxable_amount)}</td><td>₹{money(i.total_tax)}</td><td><b>₹{money(i.grand_total)}</b></td></tr>)}{!live.length&&<tr><td colSpan="7">No invoices yet.</td></tr>}</tbody></table></div></section></div>})()}
  {tab==='invoices'&&<div className="card"><div className="table-container"><table><thead><tr><th>Invoice No.</th><th>Date</th><th>Customer</th><th>Place of Supply</th><th>Station</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoices.map(i=><tr key={i.id} style={i.invoice_status==='cancelled'?{opacity:.6}:undefined}><td>{i.invoice_number}</td><td>{fmtDate(i.invoice_date)}</td><td>{i.billing_name}</td><td>{i.place_of_supply||'-'}</td><td>{i.station||'-'}</td><td>₹{money(i.grand_total)}</td><td><span style={{padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:600,whiteSpace:'nowrap',background:(STATUS_COLORS[i.invoice_status]||STATUS_COLORS.draft)[0],color:(STATUS_COLORS[i.invoice_status]||STATUS_COLORS.draft)[1]}}>{statusLabel(i.invoice_status)}</span></td><td><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className="btn btn-secondary" onClick={()=>download(i)}><Download size={14}/> PDF</button><button className="btn btn-secondary" onClick={()=>openEditInvoice(i)}>Edit</button><select aria-label={'Status of '+i.invoice_number} value={i.invoice_status||'draft'} onChange={e=>setInvoiceStatus(i,e.target.value)}>{INVOICE_STATUSES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div></td></tr>)}{!invoices.length&&<tr><td colSpan="8">No EV invoices yet.</td></tr>}</tbody></table></div></div>}
  {tab==='customers'&&<div className="card"><div className="page-header"><div><h2>Customer Management</h2><p>Manage customers used for GST invoices.</p></div><button className="btn btn-primary" onClick={()=>openCustomer()}><Plus size={14}/> Add Customer</button></div><div className="table-container"><table><thead><tr><th>Customer</th><th>GSTIN</th><th>PAN</th><th>State</th><th>State Code</th><th>Status</th><th></th></tr></thead><tbody>{customers.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.gstin||'-'}</td><td>{r.pan||'-'}</td><td>{r.billing_state||'-'}</td><td>{r.customer_state_code||'-'}</td><td>{r.active?'Active':'Inactive'}</td><td><div style={{display:'flex',gap:6}}><button className="btn btn-secondary" onClick={()=>openCustomer(r)}>Edit</button><button className="btn btn-secondary" onClick={()=>deleteCustomer(r)}><Trash2 size={14}/></button></div></td></tr>)}{!customers.length&&<tr><td colSpan="7">No customers yet.</td></tr>}</tbody></table></div></div>}
  {tab==='billing-items'&&<div className="card"><div className="page-header"><div><h2>Billing Items</h2><p>Billable EV charging services. Item names are entered manually.</p></div><button className="btn btn-primary" onClick={()=>openInventory()}><Plus size={14}/> Add Billing Item</button></div><div className="table-container"><table><thead><tr><th>Item Name</th><th>Rate / KWh</th><th>GST</th><th></th></tr></thead><tbody>{inventory.map(r=><tr key={r.id}><td>{r.product_name}</td><td>₹{money(r.selling_price)}</td><td>{r.gst_rate}%</td><td><div style={{display:'flex',gap:6}}><button className="btn btn-secondary" onClick={()=>openInventory(r)}>Edit</button><button className="btn btn-secondary" onClick={()=>deleteInventory(r)}><Trash2 size={14}/></button></div></td></tr>)}{!inventory.length&&<tr><td colSpan="4">No billing items yet.</td></tr>}</tbody></table></div></div>}
  {tab==='new'&&<div className="card new-bill">
   <div className="page-header"><div><h2>{editingInvoice?'Edit Billing Invoice':'New Billing Invoice'}</h2><p>{editingInvoice?'Editing '+editingInvoice.invoice_number+'. The invoice number stays the same.':'The invoice number is assigned when you create it.'}</p></div></div>
   <div className="form-body">
    <section className="form-section"><h3>Bill to</h3><div className="form-grid form-grid-3">
     <label data-field="customer" className={fieldError?.[0]==='customer'?'has-error':''}>Customer<div className="field-with-action"><select value={customer} onChange={e=>{setCustomer(e.target.value);clearErr('customer')}}><option value="">Select customer</option>{customers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><button type="button" className="btn btn-secondary" aria-label="Add customer" title="Add customer" onClick={()=>openCustomer()}><Plus size={14}/></button></div>{errText('customer')||(c?.gstin&&<span className="field-hint">GSTIN {c.gstin}</span>)}</label>
     <label>GST Type{autoTax&&!editingInvoice?<div className="static-value">{taxLabel(autoTax)}<span className="chip-auto">Auto from GSTIN</span></div>:<select value={manualTax} onChange={e=>setManualTax(e.target.value)}><option value="CGST_SGST">CGST + SGST</option><option value="IGST">IGST</option></select>}{editingInvoice&&<span className="field-hint">Saved as {taxLabel(savedTax(editingInvoice))}.{autoTax&&autoTax!==savedTax(editingInvoice)?' The customer GSTIN now points to '+taxLabel(autoTax)+'.':''}</span>}</label>
    </div></section>
    <section className="form-section"><h3>Service</h3><div className="form-grid form-grid-3">
     <label data-field="station" className={fieldError?.[0]==='station'?'has-error':''}>Station<div className="field-with-action"><select value={station} onChange={e=>{pickStation(stations.find(x=>x.name===e.target.value));clearErr('station')}}><option value="">Select station</option>{stations.map(x=><option value={x.name} key={x.id}>{x.name}</option>)}</select><button type="button" className="btn btn-secondary" aria-label="Add station" title="Add station" onClick={()=>setStationModal(true)}><Plus size={14}/></button></div>{errText('station')||(place&&<span className="field-hint">Place of Supply: {place}{placeCode?' ('+placeCode+')':''}</span>)}</label>
     <label data-field="from" className={fieldError?.[0]==='from'?'has-error':''}>Billing Period From<input type="date" value={from} onChange={e=>{setFrom(e.target.value);clearErr('from')}}/>{errText('from')}</label>
     <label data-field="to" className={fieldError?.[0]==='to'?'has-error':''}>Billing Period To<input type="date" value={to} min={from||undefined} max={invoiceDate} onChange={e=>{setTo(e.target.value);clearErr('to')}}/>{errText('to')}</label>
    </div></section>
    <section className="form-section" data-field="items"><div className="section-title-row"><h3>Charging Items</h3><span className="field-hint" data-field="series">Series <span className="chip-series">{series||'Not set'}</span></span></div>
     {errText('series')}
     <div className="table-container items-table"><table><thead><tr><th>Item</th><th className="num">Qty</th><th>Unit</th><th className="num">Rate ₹</th><th className="num">GST</th><th className="num">Amount ₹</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{items.map((x,i)=><tr key={i}><td><select aria-label={'Item, line '+(i+1)} value={x.inventory_id} onChange={e=>pick(i,e.target.value)}>{inventory.map(p=><option key={p.id} value={p.id}>{p.product_name} · ₹{money(p.selling_price)}</option>)}</select></td><td className="num"><input aria-label={'Quantity, line '+(i+1)} type="number" min="0" step="0.001" value={x.quantity} onChange={e=>{setItems(r=>r.map((z,n)=>n===i?{...z,quantity:e.target.value}:z));clearErr('items')}}/></td><td>{x.unit}</td><td className="num"><input aria-label={'Rate, line '+(i+1)} type="number" min="0" step="0.01" value={x.unit_price} onChange={e=>{setItems(r=>r.map((z,n)=>n===i?{...z,unit_price:e.target.value}:z));clearErr('items')}}/></td><td className="num">{x.gst_rate}%</td><td className="num"><b>{money(total.rows[i]?.taxable_amount)}</b></td><td><button type="button" className="btn btn-secondary" aria-label={'Remove line '+(i+1)} title="Remove line" onClick={()=>setItems(r=>r.filter((_,n)=>n!==i))}><Trash2 size={14}/></button></td></tr>)}{!items.length&&<tr><td colSpan="7" className="empty-row">No lines yet. <button type="button" className="link-button" onClick={()=>{inventory.length?add():setInventoryModal(true);clearErr('items')}}>Add a line</button></td></tr>}</tbody></table></div>
     {errText('items')}
     <div className="line-actions"><button type="button" className="btn btn-secondary" onClick={()=>{inventory.length?add():setInventoryModal(true);clearErr('items')}}><Plus size={14}/> Add line</button><button type="button" className="link-button" onClick={()=>openInventory()}>Create a new billing item…</button></div>
    </section>
    <div className="bill-totals"><div className="summary-row"><span>Taxable Amount</span><b>₹{money(total.taxable)}</b></div>{taxType==='IGST'?<div className="summary-row"><span>IGST</span><b>₹{money(total.igst)}</b></div>:<><div className="summary-row"><span>CGST</span><b>₹{money(total.cgst)}</b></div><div className="summary-row"><span>SGST</span><b>₹{money(total.sgst)}</b></div></>}<div className="summary-row"><span>Round Off</span><b>₹{money(total.round)}</b></div><div className="summary-row total"><span>Total</span><b>₹{money(total.total)}</b></div></div>
   </div>
   <div className="form-actions">{editingInvoice&&<button type="button" className="btn btn-secondary" onClick={()=>{setEditingInvoice(null);setItems([]);setCustomer('');setStation('');setFrom('');setTo('');setFieldError(null);setTab('invoices')}}>Cancel Edit</button>}<button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving?(editingInvoice?'Saving…':'Creating…'):(editingInvoice?'Save Invoice Changes':'Create Invoice')}</button></div>
  </div>}
  {stationModal&&<Modal title="Add Station" onClose={()=>setStationModal(false)}><form onSubmit={saveStation}><div className="form-grid modal-grid"><label>Station Name *<input autoFocus value={stationName} onChange={e=>setStationName(e.target.value)} placeholder="Triarc EV Hub | Bhadrachalam"/></label><label>Place of Supply (on invoice) *<input value={placeName} onChange={e=>setPlaceName(e.target.value)} placeholder="Bhadrachalam-Telangana"/></label><label>State Code *<input maxLength="2" inputMode="numeric" value={placeStateCode} onChange={e=>setPlaceStateCode(e.target.value.replace(/\D/g,'').slice(0,2))} placeholder="36"/></label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setStationModal(false)}>Cancel</button><button className="btn btn-primary" disabled={stationSaving}>{stationSaving?'Saving…':'Add Station'}</button></div></form></Modal>}
  {customerModal&&<Modal title={editingCustomer?"Edit Customer":"Add Customer"} onClose={()=>setCustomerModal(false)}><form onSubmit={addCustomer}><div className="customer-master-note">Billing Customer Master · Business customer</div><div className="form-grid modal-grid">
    <label>Customer Name *<input autoFocus value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})} placeholder="Customer / Company Name"/></label><label>GSTIN<input maxLength="15" value={customerForm.gstin} onChange={e=>setCustomerForm({...customerForm,gstin:e.target.value.toUpperCase()})}/></label><label>PAN<input maxLength="10" value={customerForm.pan} onChange={e=>setCustomerForm({...customerForm,pan:e.target.value.toUpperCase()})}/></label><label style={{gridColumn:'1 / -1'}}>Billing Address<textarea rows={3} value={customerForm.billing_address_line1} onChange={e=>setCustomerForm({...customerForm,billing_address_line1:e.target.value})} placeholder="Building, street, area, landmark"/></label><label>City<input value={customerForm.billing_city} onChange={e=>setCustomerForm({...customerForm,billing_city:e.target.value})}/></label><label>State{stateSelect(customerForm.billing_state,v=>setCustomerForm(f=>({...f,billing_state:v,customer_state_code:f.gstin?f.customer_state_code:GST_STATES.find(x=>x[1]===v)?.[0]||''})))}</label><label>Pincode<input value={customerForm.billing_pincode} onChange={e=>setCustomerForm({...customerForm,billing_pincode:e.target.value})}/></label><label>State Code<input maxLength="2" value={customerForm.customer_state_code || gstState(customerForm.gstin) || ''} onChange={e=>setCustomerForm({...customerForm,customer_state_code:e.target.value.replace(/\D/g,'').slice(0,2)})} placeholder="Auto from GSTIN"/></label>
   </div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setCustomerModal(false)}>Cancel</button><button className="btn btn-primary" disabled={customerSaving}>{customerSaving?'Saving…':editingCustomer?'Save Changes':'Add Customer'}</button></div></form></Modal>}
  {inventoryModal&&<Modal title={editingInventory?"Edit Billing Item":"Add Billing Item"} onClose={()=>setInventoryModal(false)}><form onSubmit={addInventory}><div className="form-grid modal-grid">
    <label>Item Name *<input autoFocus value={inventoryForm.product_name} onChange={e=>setInventoryForm({...inventoryForm,product_name:e.target.value})} placeholder="e.g. DC EV Charging"/></label>
    <label>Purchase Price<input type="number" min="0" step="0.01" value={inventoryForm.purchase_price} onChange={e=>setInventoryForm({...inventoryForm,purchase_price:e.target.value})}/></label>
    <label>Selling Price / KWH *<input type="number" min="0" step="0.01" value={inventoryForm.selling_price} onChange={e=>setInventoryForm({...inventoryForm,selling_price:e.target.value})}/></label>
    <label>GST % *<input type="number" min="0" step="0.01" value={inventoryForm.gst_rate} onChange={e=>setInventoryForm({...inventoryForm,gst_rate:e.target.value})}/></label>
    <label>Notes<input value={inventoryForm.notes} onChange={e=>setInventoryForm({...inventoryForm,notes:e.target.value})}/></label>
   </div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setInventoryModal(false)}>Cancel</button><button className="btn btn-primary" disabled={inventorySaving}>{inventorySaving?'Saving…':editingInventory?'Save Changes':'Add Item'}</button></div></form></Modal>}
    </main>
  </div>;
}
