import { inflateRawSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';

// Validate every local entry as well as the central directory before the streaming
// XML reader sees it. Declared sizes alone do not bound actual decompression.
export function validateXlsxArchive(bytes:Buffer):void {
 const fail=():never=>{throw new BadRequestException('XLSX-Archiv beschädigt, verschlüsselt oder zu groß.');};
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50&&p+22+bytes.readUInt16LE(p+20)===bytes.length){end=p;break;}
 if(end<0||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0)fail();
 const count=bytes.readUInt16LE(end+10),central=bytes.readUInt32LE(end+16),centralSize=bytes.readUInt32LE(end+12);
 if(!count||count>100||bytes.readUInt16LE(end+8)!==count||central+centralSize!==end)fail();
 let pos=central,total=0;const names=new Set<string>(),entries:{offset:number;end:number;descriptor:boolean;compressed:number;size:number;crc:number}[]=[];
 for(let n=0;n<count;n++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)fail();
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),compressed=bytes.readUInt32LE(pos+20),size=bytes.readUInt32LE(pos+24),nameLength=bytes.readUInt16LE(pos+28),offset=bytes.readUInt32LE(pos+42),crc=bytes.readUInt32LE(pos+16);
  const next=pos+46+nameLength+bytes.readUInt16LE(pos+30)+bytes.readUInt16LE(pos+32);
  if(next>end||size>10_000_000||compressed>bytes.length||flags&1||![0,8].includes(method)||offset+30>central||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(pos+34)!==0)fail();
  const name=bytes.subarray(pos+46,pos+46+nameLength),label=name.toString('utf8');
  if(!label||names.has(label)||label.includes('\0')||label.includes('\\')||label.startsWith('/')||label.split('/').includes('..'))fail();names.add(label);
  const localNameLength=bytes.readUInt16LE(offset+26),start=offset+30+localNameLength+bytes.readUInt16LE(offset+28);
  if(start+compressed>central||!bytes.subarray(offset+30,offset+30+localNameLength).equals(name)||bytes.readUInt16LE(offset+8)!==method||bytes.readUInt16LE(offset+6)!==flags)fail();
  const descriptor=Boolean(flags&8);
  if(descriptor&&(![0,compressed].includes(bytes.readUInt32LE(offset+18))||![0,size].includes(bytes.readUInt32LE(offset+22))||![0,crc].includes(bytes.readUInt32LE(offset+14))||(method===0&&!bytes.readUInt32LE(offset+18))))fail();
  if(!descriptor&&(bytes.readUInt32LE(offset+18)!==compressed||bytes.readUInt32LE(offset+22)!==size||bytes.readUInt32LE(offset+14)!==crc))fail();
  let inflated:Buffer;
  try{if(method===0)inflated=bytes.subarray(start,start+compressed);else{const result=inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:10_000_000,info:true}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}};if(result.engine.bytesWritten!==compressed)fail();inflated=result.buffer;}}catch{fail();}
  if(inflated!.length!==size)fail();total+=inflated!.length;if(total>50_000_000)fail();
  entries.push({offset,end:start+compressed,descriptor,compressed,size,crc});pos=next;
 }
 if(pos!==end)fail();entries.sort((a,b)=>a.offset-b.offset);
 let expected=0;
 for(let i=0;i<entries.length;i++){
  const entry=entries[i],next=i+1<entries.length?entries[i+1].offset:central;
  if(entry.offset!==expected)fail();
  if(entry.descriptor){let p=entry.end;if(p+4<=next&&bytes.readUInt32LE(p)===0x08074b50)p+=4;if(p+12!==next||bytes.readUInt32LE(p)!==entry.crc||bytes.readUInt32LE(p+4)!==entry.compressed||bytes.readUInt32LE(p+8)!==entry.size)fail();}
  else if(entry.end!==next)fail();
  expected=next;
 }
 if(!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))fail();
}
