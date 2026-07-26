import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const file=path.join(process.cwd(),"drizzle/0016_sprint4_certificate_quality_governance.sql");
const sql=fs.readFileSync(file,"utf8");
const errors=[]; let state="normal", depth=0, statements=0, lastSignificant="";
for(let i=0;i<sql.length;i+=1){const c=sql[i],n=sql[i+1];
 if(state==="line-comment"){if(c==="\n")state="normal";continue;}
 if(state==="block-comment"){if(c==="*"&&n==="/"){state="normal";i+=1;}continue;}
 if(state==="single-quote"){if(c==="\\"){i+=1;continue;}if(c==="'"&&n==="'"){i+=1;continue;}if(c==="'")state="normal";continue;}
 if(state==="backtick"){if(c==="`"&&n==="`"){i+=1;continue;}if(c==="`")state="normal";continue;}
 if(c==="-"&&n==="-"){state="line-comment";i+=1;continue;} if(c==="/"&&n==="*"){state="block-comment";i+=1;continue;}
 if(c==="'"){state="single-quote";lastSignificant=c;continue;} if(c==="`"){state="backtick";lastSignificant=c;continue;}
 if(c==="(")depth+=1; if(c===")"){depth-=1;if(depth<0)errors.push(`Unexpected closing parenthesis at ${i}`);} if(c===";")statements+=1; if(!/\s/.test(c))lastSignificant=c;
}
if(state!=="normal"&&state!=="line-comment")errors.push(`Unterminated SQL state ${state}`); if(depth!==0)errors.push(`Unbalanced parentheses depth=${depth}`); if(lastSignificant!==";")errors.push("Migration must end with semicolon."); if(statements<9)errors.push(`Unexpectedly low statement count ${statements}`); if(sql.includes("JSON_TABLE("))errors.push("TiDB does not support JSON_TABLE.");
for(const required of ["workflow_evidence_attachments","certificate_records","defect_notifications","punch_items","ndt_records","workflow.certificate.issue","workflow.quality.ndt.review"]) if(!sql.includes(required))errors.push(`Missing ${required}`);
const report={file:path.relative(process.cwd(),file),statements,balancedParentheses:depth===0,lexicalState:state,passed:errors.length===0,errors}; console.log(JSON.stringify(report,null,2)); if(errors.length)process.exit(1);
