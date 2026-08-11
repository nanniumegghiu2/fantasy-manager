import xlsx from "xlsx";
const wb = xlsx.readFile("../../Cartel1.xlsx");
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const counts = {};
for (const r of rows) { const c = r["Campionato"] ?? "?"; counts[c] = (counts[c]||0)+1; }
console.log("totale righe:", rows.length);
console.log(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>`${v}\t${k}`).join("\n"));
