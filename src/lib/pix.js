// Pix "Copia e Cola" (BR Code / EMV) com valor dinâmico. Escaneável por qualquer banco.
function emv(id, value){const len=String(value.length).padStart(2,"0");return `${id}${len}${value}`;}
function crc16(p){let c=0xffff;for(let i=0;i<p.length;i++){c^=p.charCodeAt(i)<<8;for(let j=0;j<8;j++){c=c&0x8000?(c<<1)^0x1021:c<<1;c&=0xffff;}}return c.toString(16).toUpperCase().padStart(4,"0");}
function clean(str,max){return (str||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9 ]/g,"").trim().slice(0,max);}
export function buildPixPayload({ key, name, city, amount, txid = "***" }) {
  const mai = emv("26", emv("00","br.gov.bcb.pix") + emv("01", key));
  const amt = amount != null && !isNaN(amount) ? emv("54", Number(amount).toFixed(2)) : "";
  const add = emv("62", emv("05", (txid||"***").replace(/[^A-Za-z0-9]/g,"").slice(0,25) || "***"));
  const partial = emv("00","01")+mai+emv("52","0000")+emv("53","986")+amt+emv("58","BR")+emv("59",clean(name,25))+emv("60",clean(city,15))+add+"6304";
  return partial + crc16(partial);
}
