(function(){
'use strict';
var BANK=Array.isArray(window.QUESTION_BANK)?window.QUESTION_BANK:[];
var STORE='residencyAtlas.v1';
var state={answers:{},bookmarks:[],flags:[],font:17,dark:false,showNotes:true};
var filters={q:'',year:'',session:'',subject:'',topic:'',subtopic:'',type:'',status:'all',sort:'source'};
var page='home',currentId='',mode='study',revealed=new Set(),selected={},queue=[],queuePos=0,limit=30,timer=0;
var $=function(s,root){return (root||document).querySelector(s);};
var $$=function(s,root){return Array.from((root||document).querySelectorAll(s));};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function readState(){try{var s=JSON.parse(localStorage.getItem(STORE)||'{}');state=Object.assign(state,s);state.answers=state.answers||{};state.bookmarks=state.bookmarks||[];state.flags=state.flags||[];}catch(e){} if(state.dark)document.body.classList.add('dark');document.documentElement.style.fontSize=state.font+'px';}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){} updateRail();}
function updateRail(){var done=Object.keys(state.answers).filter(function(k){return state.answers[k]&&state.answers[k].answered;}).length;var bc=state.bookmarks.length,mc=Object.keys(state.answers).filter(function(k){return state.answers[k]&&state.answers[k].status==='incorrect';}).length;var pc=$('#bookCount');if(pc)pc.textContent=bc;pc=$('#mistakeCount');if(pc)pc.textContent=mc;pc=$('#verifyCount');if(pc)pc.textContent=state.flags.length;pc=$('#doneCount');if(pc)pc.textContent=done+' / '+BANK.length;pc=$('#progressBar');if(pc)pc.style.width=(done/Math.max(1,BANK.length)*100)+'%';}
function plain(s){return String(s||'').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*_~\x60>|]/g,' ').replace(/\s+/g,' ').trim();}
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>').replace(/\*([^*]+)\*/g,'<em>$1</em>');}
function renderMd(src){
 var lines=String(src||'').split(/\r?\n/),out=[],ul=false,ol=false,quote=false,table=false;
 function closeLists(){if(ul){out.push('</ul>');ul=false;}if(ol){out.push('</ol>');ol=false;}if(quote){out.push('</blockquote>');quote=false;}if(table){out.push('</tbody></table></div>');table=false;}}
 for(var i=0;i<lines.length;i++){var ln=lines[i],t=ln.trim();
  if(!t){closeLists();continue;}
  if(/^\|.*\|$/.test(t)){
   if(!table){closeLists();out.push('<div class="md-table-wrap"><table class="md-table"><tbody>');table=true;}
   if(/^\|[\s:|-]+\|$/.test(t))continue;
   var cells=t.replace(/^\|/,'').replace(/\|$/,'').split('|');
   out.push('<tr>'+cells.map(function(c){return '<td>'+inline(c.trim())+'</td>';}).join('')+'</tr>');continue;
  }else if(table){out.push('</tbody></table></div>');table=false;}
  var m;
  if((m=t.match(/^(#{1,4})\s+(.+)$/))){closeLists();out.push('<h'+Math.min(4,m[1].length+1)+'>'+inline(m[2])+'</h'+Math.min(4,m[1].length+1)+'>');continue;}
  if((m=t.match(/^[-*]\s+(.+)$/))){if(ol){out.push('</ol>');ol=false;}if(!ul){out.push('<ul>');ul=true;}out.push('<li>'+inline(m[1])+'</li>');continue;}
  if((m=t.match(/^\d+[.)]\s+(.+)$/))){if(ul){out.push('</ul>');ul=false;}if(!ol){out.push('<ol>');ol=true;}out.push('<li>'+inline(m[1])+'</li>');continue;}
  if((m=t.match(/^>\s?(.*)$/))){if(ul||ol){if(ul){out.push('</ul>');ul=false;}if(ol){out.push('</ol>');ol=false;}}if(!quote){out.push('<blockquote>');quote=true;}out.push('<p>'+inline(m[1])+'</p>');continue;}
  closeLists();out.push('<p>'+inline(t)+'</p>');
 }
 closeLists();return out.join('');
}
function years(){var a=[];BANK.forEach(function(q){(q.years||[]).forEach(function(y){if(a.indexOf(String(y))<0)a.push(String(y));});});return a.sort(function(a,b){return +b-(+a);});}
function uniq(field){var a=[];BANK.forEach(function(q){var raw=q[field],vals=Array.isArray(raw)?raw:[raw];vals.forEach(function(v){if(v&&v!=='Unclassified'&&a.indexOf(v)<0)a.push(v);});});return a.sort(function(a,b){return String(a).localeCompare(String(b));});}
function optList(vals,current,label){return '<option value="">'+label+'</option>'+vals.map(function(v){var p=String(v).split('\u0001'),value=p[0],title=p[1]||p[0];return '<option value="'+esc(value)+'" '+(String(value)===String(current)?'selected':'')+'>'+esc(title)+'</option>';}).join('');}
function isBookmarked(id){return state.bookmarks.indexOf(id)>=0;}
function isFlagged(id){return state.flags.indexOf(id)>=0;}
function statusOf(q){var a=state.answers[q.id];if(!a||!a.answered)return 'unanswered';return a.status||'unverified';}
function filtered(){
 var txt=filters.q.toLowerCase().trim();
 var out=BANK.filter(function(q){
  if(txt && !(q.searchText||plain(q.originalMarkdown)).includes(txt))return false;
  if(filters.year && !(q.years||[]).map(String).includes(String(filters.year)))return false;
  if(filters.session && !(q.sessionBuckets||[]).includes(filters.session))return false;
  if(filters.subject&&q.subject!==filters.subject)return false;
  if(filters.topic&&q.coverageTitle!==filters.topic)return false;
  if(filters.subtopic&&q.subtopic!==filters.subtopic)return false;
  if(filters.type&&q.questionType!==filters.type)return false;
  var st=filters.status;
  if(st==='bookmarked'&&!isBookmarked(q.id))return false;
  if(st==='incorrect'&&statusOf(q)!=='incorrect')return false;
  if(st==='unanswered'&&statusOf(q)!=='unanswered')return false;
  if(st==='verify'&&!isFlagged(q.id)&&q.answerStatus!=='needs-review')return false;
  return true;
 });
 out.sort(function(a,b){
  if(filters.sort==='year')return (Math.max.apply(null,b.years||[0])-Math.max.apply(null,a.years||[0]))||a.id.localeCompare(b.id,undefined,{numeric:true});
  if(filters.sort==='subject')return a.subject.localeCompare(b.subject)||a.subtopic.localeCompare(b.subtopic)||a.id.localeCompare(b.id,undefined,{numeric:true});
  if(filters.sort==='topic')return a.coverageTitle.localeCompare(b.coverageTitle)||a.subtopic.localeCompare(b.subtopic)||a.id.localeCompare(b.id,undefined,{numeric:true});
  if(filters.sort==='type')return a.questionType.localeCompare(b.questionType)||a.id.localeCompare(b.id,undefined,{numeric:true});
  return a.id.localeCompare(b.id,undefined,{numeric:true});
 });return out;
}
function setPage(p){page=p;queue=[];currentId='';render();}
function setActiveNav(){ $$('.nav,.bottom-nav button').forEach(function(b){var a=b.dataset.action||'';b.classList.toggle('active',a===page||(page==='question'&&a==='home')||(page==='practice'&&a==='practice'));});}
function shellHead(eyebrow,title,subtitle,actions){return '<div class="page-head"><div><div class="eyebrow">'+esc(eyebrow)+'</div><h1>'+esc(title)+'</h1><p>'+esc(subtitle||'')+'</p></div><div class="head-actions">'+(actions||'')+'</div></div>';}
function stat(label,note,value){return '<div class="stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><span>'+esc(note)+'</span></div>';}
function card(q){var title=plain(q.stemMarkdown)||'(Question stem not available)';if(title.length>300)title=title.slice(0,300)+'…';var a=state.answers[q.id],tags='<span class="tag">'+esc(q.subject)+'</span><span class="tag">'+esc(q.subtopic)+'</span><span class="tag">'+(q.questionType==='tf'?'True / False':q.questionType==='sba'?'Single best answer':'Format not classified')+'</span>'+(q.years||[]).map(function(y){return '<span class="tag source">'+esc(y)+'</span>';}).join('')+'<span class="tag '+(q.answerStatus==='keyed'?'source':'warn')+'">'+(q.answerStatus==='keyed'?'Source key parsed':'Needs key review')+'</span>';
 return '<article class="question-card"><div class="q-index">'+esc(q.id.replace(/^Q/i,''))+'</div><div class="q-card-main"><h3>'+esc(title)+'</h3><div class="q-meta">'+tags+'</div>'+(a&&a.answered?'<p class="small-note">Last attempt: '+esc(a.status==='correct'?'matches source key':a.status==='incorrect'?'differs from source key':'key needs review')+'</p>':'')+'</div><div class="q-card-side"><button class="bookmark-mini" data-bookmark="'+esc(q.id)+'" aria-label="Bookmark question">'+(isBookmarked(q.id)?'★':'☆')+'</button><button class="open-mini" data-open="'+esc(q.id)+'">Open →</button></div></article>';}
function homePage(){
 page='home';var done=Object.keys(state.answers).filter(function(k){return state.answers[k]&&state.answers[k].answered;}).length;var correct=Object.values(state.answers).filter(function(a){return a&&a.answered&&a.status==='correct';}).length;
 var actions='<button class="secondary" data-action="settings">Settings & data</button><button class="primary" data-action="practice">Start practice →</button>';
 var html=shellHead('THE QUESTION BANK','Explore Residency Part 1','Search and combine filters across source year, session, subject, topic and question format.',actions);
 html+='<section class="hero"><div><h2>Study by your own logic.</h2><p>Every question is kept linked to its original source, topic notes and answer-key status. Offline first, with online verification when needed.</p></div><div class="hero-num">'+BANK.length+'<small>questions imported</small></div></section>';
 html+='<div class="stats">'+stat('Completed','Questions attempted',done)+' '+stat('Matches','Source-key matches',correct)+' '+stat('Bookmarked','Saved for later',state.bookmarks.length)+' '+stat('Flagged','Needs your review',state.flags.length)+'</div>';
 html+='<div class="section-head"><h2>Find a question</h2><span class="muted">'+BANK.length+' total records</span></div>';
 html+='<section class="filter-panel"><div class="search-row"><div class="field"><label for="searchBox">SEARCH ALL QUESTION TEXT</label><input id="searchBox" class="search-input" data-filter="q" value="'+esc(filters.q)+'" placeholder="Search a clinical clue, option, topic or explanation…"></div></div><div class="filter-grid">';
 html+='<div class="field"><label>EXAM YEAR</label><select data-filter="year">'+optList(years(),filters.year,'All years')+'</select></div>';
 html+='<div class="field"><label>EXAM SESSION / SOURCE</label><select data-filter="session">'+optList(uniq('sessionBuckets').concat(BANK.reduce(function(a,q){(q.sessionBuckets||[]).forEach(function(v){if(a.indexOf(v)<0)a.push(v);});return a;},[])).filter(function(v,i,a){return a.indexOf(v)===i;}).sort(),filters.session,'All sessions')+'</select></div>';
 html+='<div class="field"><label>SUBJECT</label><select data-filter="subject">'+optList(uniq('subject'),filters.subject,'All subjects')+'</select></div>';
 html+='<div class="field"><label>HIGH-YIELD TOPIC</label><select data-filter="topic">'+optList(uniq('coverageTitle'),filters.topic,'All high-yield topics')+'</select></div>';
 html+='<div class="field"><label>SUBTOPIC / CHAPTER</label><select data-filter="subtopic">'+optList(uniq('subtopic'),filters.subtopic,'All subtopics')+'</select></div>';
 html+='<div class="field"><label>QUESTION FORMAT</label><select data-filter="type">'+optList([{v:'tf',t:'True / False'},{v:'sba',t:'Single Best Answer'},{v:'unknown',t:'Unclassified'}].map(function(x){return x.v+'\u0001'+x.t;}),filters.type,'All formats').replace(/<option value="([^"]+)">([^<]*)<\/option>/g,function(m,v,t){var p=v.split('\u0001');return '<option value="'+esc(p[0])+'">'+esc(p[1]||t)+'</option>';})+'</select></div>';
 html+='<div class="field"><label>PROGRESS</label><select data-filter="status">'+optList([{v:'all',t:'All questions'},{v:'unanswered',t:'Unanswered'},{v:'incorrect',t:'Incorrect previously'},{v:'bookmarked',t:'Bookmarked'},{v:'verify',t:'Needs verification'}].map(function(x){return x.v+'\u0001'+x.t;}),filters.status,'All questions').replace(/<option value="([^"]+)">([^<]*)<\/option>/g,function(m,v,t){var p=v.split('\u0001');return '<option value="'+esc(p[0])+'" '+(p[0]===filters.status?'selected':'')+'>'+esc(p[1]||t)+'</option>';})+'</select></div></div>';
 html+='<div class="filter-bottom"><div class="chip-row"><button class="chip '+(filters.status==='all'?'active':'')+'" data-status="all">All</button><button class="chip '+(filters.status==='unanswered'?'active':'')+'" data-status="unanswered">Unanswered</button><button class="chip '+(filters.status==='incorrect'?'active':'')+'" data-status="incorrect">Incorrect</button><button class="chip '+(filters.status==='bookmarked'?'active':'')+'" data-status="bookmarked">Bookmarked</button><button class="chip '+(filters.status==='verify'?'active':'')+'" data-status="verify">Verify</button></div><div class="field"><label>SORT RESULTS</label><select data-filter="sort">'+optList([{v:'source',t:'Source order'},{v:'year',t:'Newest year first'},{v:'subject',t:'Subject'},{v:'topic',t:'Topic'},{v:'type',t:'Question format'}].map(function(x){return x.v+'\u0001'+x.t;}),filters.sort,'Source order').replace(/<option value="([^"]+)">([^<]*)<\/option>/g,function(m,v,t){var p=v.split('\u0001');return '<option value="'+esc(p[0])+'" '+(p[0]===filters.sort?'selected':'')+'>'+esc(p[1]||t)+'</option>';})+'</select></div></div></section>';
 var res=filtered();html+='<div class="section-head"><h2>Question results</h2><span class="muted">'+res.length+' matches</span></div><div class="results-list">';
 var shown=res.slice(0,limit);html+=shown.map(card).join('')||'<div class="empty"><h3>No matching questions</h3><p>Try clearing a filter or using a broader search term.</p><button class="secondary" data-action="clear-filters">Clear filters</button></div>';html+='</div>';
 if(res.length>limit)html+='<div class="section-head"><span class="muted">Showing '+shown.length+' of '+res.length+'</span><button class="secondary" data-action="more">Load more questions ↓</button></div>';
 $('#main').innerHTML=html;setActiveNav();updateRail();
}
function queueForPage(){if(queue.length)return queue;return filtered().map(function(q){return q.id;});}
function detailQuestion(){var q=BANK.find(function(x){return x.id===currentId;});if(!q){homePage();return;}
 page='question';var qu=queueForPage(),idx=qu.indexOf(q.id);if(idx<0){qu=[q.id];idx=0;queue=qu;}
 var prev=qu[idx-1],next=qu[idx+1],a=state.answers[q.id]||{},sel=selected[q.id]||a.choices||{},revealedNow=revealed.has(q.id)||a.revealed===true;
 var title=plain(q.stemMarkdown);if(title.length>450)title=title.slice(0,450);
 var meta='<span class="tag">'+esc(q.subject)+'</span><span class="tag">'+esc(q.subtopic)+'</span><span class="tag">'+(q.questionType==='tf'?'True / False':q.questionType==='sba'?'Single Best Answer':'Unknown format')+'</span>'+(q.years||[]).map(function(y){return '<span class="tag source">'+esc(y)+'</span>';}).join('')+'<span class="tag">'+esc((q.sessionBuckets||[]).join(' · ')||'Year/session not specified')+'</span>';
 var html='';
 if(queue.length)html+='<div class="session-banner"><div><h2>Practice session</h2><p>Question order can be randomized; progress is saved on this device.</p></div><span class="session-progress">'+(idx+1)+' / '+qu.length+'</span></div>';
 html+='<div class="detail-toolbar"><button class="secondary" data-action="back-results">← Back to questions</button><div class="detail-nav"><button class="secondary" data-action="prev-question" '+(!prev?'disabled':'')+'>← Previous</button><button class="secondary" data-action="next-question" '+(!next?'disabled':'')+'>Next →</button></div></div>';
 html+='<div class="detail-title"><span class="q-id">'+esc(q.id)+'</span><div><h1>'+esc(title||'Question')+'</h1><div class="tag-row">'+meta+'</div></div></div>';
 html+='<div class="detail-toolbar"><div class="chip-row"><button class="chip '+(mode==='study'?'active':'')+'" data-mode="study">Study mode</button><button class="chip '+(mode==='practice'?'active':'')+'" data-mode="practice">Interactive practice</button></div><div class="detail-nav"><button class="secondary" data-bookmark="'+esc(q.id)+'">'+(isBookmarked(q.id)?'★ Bookmarked':'☆ Bookmark')+'</button><button class="'+(isFlagged(q.id)?'danger':'secondary')+'" data-flag="'+esc(q.id)+'">'+(isFlagged(q.id)?'⚑ Flagged':'⚑ Verify later')+'</button></div></div>';
 html+='<div class="detail-layout"><div><section class="content-card"><h2>Question stem</h2><div class="stem-content">'+renderMd(q.stemMarkdown)+'</div><div class="options-list">';
 if(q.questionType==='tf'){
 q.options.forEach(function(o){var choice=sel[o.key],key=choice===true?'true':choice===false?'false':'',checked=revealedNow||a.checkedThisView,truth=o.truth,good=checked&&truth!==null&&choice===truth,bad=checked&&truth!==null&&choice!==undefined&&choice!==truth;
 html+='<div class="option-row"><span class="option-letter">'+esc(o.key.toUpperCase())+'</span><div class="option-text">'+renderMd(o.text)+'</div><div class="tf-controls"><button class="tf-btn '+(choice===true?'chosen':'')+' '+(good&&truth===true?'answer-correct':'')+' '+(bad&&choice===true?'answer-wrong':'')+'" data-tf="'+esc(o.key)+'" data-value="true" data-qid="'+esc(q.id)+'" aria-label="'+esc(o.key)+' True">T</button><button class="tf-btn '+(choice===false?'chosen':'')+' '+(good&&truth===false?'answer-correct':'')+' '+(bad&&choice===false?'answer-wrong':'')+'" data-tf="'+esc(o.key)+'" data-value="false" data-qid="'+esc(q.id)+'" aria-label="'+esc(o.key)+' False">F</button>'+(checked&&truth!==null?'<span class="option-status '+(truth?'status-true':'status-false')+'">'+(truth?'TRUE':'FALSE')+'</span>':'')+'</div></div>';
 });
 }else{
 q.options.forEach(function(o){var checked=revealedNow||a.checkedThisView,correct=checked&&o.isBestAnswer,wrong=checked&&sel.sba===o.key&&!o.isBestAnswer;
 html+='<button class="option-row sba '+(sel.sba===o.key?'selected ':'')+(correct?'correct ':'')+(wrong?'wrong':'')+'" data-sba="'+esc(o.key)+'" data-qid="'+esc(q.id)+'"><span class="option-letter">'+esc(o.key.toUpperCase())+'</span><span class="option-text">'+renderMd(o.text)+'</span>'+(checked&&o.isBestAnswer?'<span class="option-status status-correct">SOURCE KEY</span>':'')+(checked&&sel.sba===o.key&&!o.isBestAnswer?'<span class="option-status status-incorrect">YOUR PICK</span>':'')+'</button>';
 });
 }
 html+='</div>';
 if(mode==='practice'){
 if(!revealedNow)html+='<div class="question-actions"><button class="primary" data-action="check-answer">✓ Check answer</button><button class="secondary" data-action="reveal-answer">Reveal source key</button></div>';
 else html+='<div class="question-actions"><button class="primary" data-action="next-question" '+(!next?'disabled':'')+'>'+(next?'Next question →':'Finish practice')+'</button><button class="secondary" data-action="hide-answer">Hide key & try again</button></div>';
 }else html+='<div class="question-actions"><button class="primary" data-mode="practice">▷ Practise this question</button><button class="secondary" data-action="reveal-answer">Show source key</button></div>';
 if(revealedNow||a.checkedThisView){
 if(q.answerStatus==='keyed'){
 var status=a.answered?(a.status==='correct'?'Your selection matches the supplied source key.':a.status==='incorrect'?'Your selection differs from the supplied source key.':'This source key is present but not independently verified.'):'Source key shown exactly as imported. This is not an independent medical verification.';
 html+='<div class="answer-feedback '+(a.status==='correct'?'good':a.status==='incorrect'?'bad':'')+'">'+esc(status)+'</div>';
 }else html+='<div class="answer-feedback">This source record has no complete machine-readable answer key. It needs manual review; no answer was invented by the importer.</div>';
 }
 html+='<div class="tag-row mt"><span class="tag source">Original source: '+esc(q.appearance||'not listed')+'</span><span class="tag '+(q.answerStatus==='keyed'?'source':'warn')+'">'+(q.answerStatus==='keyed'?'Source-key structure detected':'Answer key needs review')+'</span></div></section>';
 html+='<section class="content-card notes-card"><button class="notes-toggle" data-action="toggle-notes"><h2>High-yield topic coverage</h2><span>'+(state.showNotes?'−':'+')+'</span></button>'+(state.showNotes?'<div class="notes-body">'+(q.coverageMarkdown?renderMd(q.coverageMarkdown):'<p class="muted">No separate topic coverage section was present in the source record.</p>')+'</div>':'')+'</section>';
 html+='<details class="content-card notes-card"><summary class="notes-toggle"><h2>Full original source record</h2><span>Open</span></summary><div class="notes-body">'+renderMd(q.originalMarkdown)+'</div></details></div>';
 html+='<aside class="side-stack"><section class="content-card"><div class="side-card-title">Question details</div><div class="side-stat"><div class="mini-stat"><strong>'+esc((q.years||[]).join(', ')||'—')+'</strong><span>Exam year(s)</span></div><div class="mini-stat"><strong>'+q.options.length+'</strong><span>Options / stems</span></div></div><div class="side-line"><span>Subject</span><strong>'+esc(q.subject)+'</strong></div><div class="side-line"><span>Subtopic</span><strong>'+esc(q.subtopic)+'</strong></div><div class="side-line"><span>Progress</span><strong>'+(a.answered?'Attempted':'Not attempted')+'</strong></div><div class="side-line"><span>Last result</span><strong>'+esc(a.answered?(a.status==='correct'?'Matches source key':a.status==='incorrect'?'Review':'Not scored'):'—')+'</strong></div></section>';
 html+='<section class="verify-box"><h3>Verify answer online</h3><p>Ask ChatGPT to solve the question independently, check current evidence and compare its conclusion with the bank’s original key. You review the final judgement.</p><div class="verify-actions"><button class="verify-source" data-verify-source="chatgpt">Ask ChatGPT ↗</button><button class="verify-source" data-verify-source="google">Google search ↗</button><button class="verify-source" data-verify-source="guidelines">Guidelines / WHO ↗</button></div><div class="verify-disclaimer">Review source authority, publication date and applicability. The original answer is preserved separately from your conclusion.</div></section></aside></div>';
 $('#main').innerHTML=html;setActiveNav();updateRail();
}
function resultsTitle(){if(page==='bookmarks')return 'Bookmarked questions';if(page==='mistakes')return 'Mistake review';if(page==='verify')return 'Questions needing verification';return 'Questions';}
function listPage(){
 var title=resultsTitle();var prior=filters.status;
 if(page==='bookmarks')filters.status='bookmarked';else if(page==='mistakes')filters.status='incorrect';else if(page==='verify')filters.status='verify';
 var arr=filtered();filters.status=prior;
 var html=shellHead('QUESTION LIBRARY',title,'Review the original questions and keep source answer keys distinct from verified conclusions.','<button class="primary" data-action="practice">Practise this set →</button><button class="secondary" data-action="home">Filters</button>');
 html+='<div class="filter-panel"><div class="field"><label>SEARCH THESE QUESTIONS</label><input class="search-input" data-filter="q" value="'+esc(filters.q)+'" placeholder="Search by stem, option or topic…"></div><div class="filter-bottom"><span class="muted">'+arr.length+' questions</span><button class="secondary" data-action="clear-search">Clear search</button></div></div><div class="results-list">'+arr.slice(0,limit).map(card).join('')+'</div>';
 if(!arr.length)html+='<div class="empty">No questions in this section yet.</div>';
 if(arr.length>limit)html+='<div class="section-head"><span class="muted">Showing '+Math.min(limit,arr.length)+' of '+arr.length+'</span><button class="secondary" data-action="more">Load more questions</button></div>';
 $('#main').innerHTML=html;setActiveNav();updateRail();
}
function analyticsPage(){
 var ans=Object.values(state.answers).filter(function(a){return a&&a.answered;}),correct=ans.filter(function(a){return a.status==='correct';}).length,wrong=ans.filter(function(a){return a.status==='incorrect';}).length,notScored=ans.length-correct-wrong;
 var subjects=uniq('subject'),html=shellHead('YOUR STUDY DATA','Progress & analytics','Use progress to identify weak areas. Scores compare selections with imported source keys only.','<button class="secondary" data-action="settings">Export / import</button>');
 html+='<div class="stats">'+stat('Attempted','Questions with a saved result',ans.length)+' '+stat('Matches','Matches supplied source key',correct)+' '+stat('Differed','Does not match source key',wrong)+' '+stat('Not scored','No complete source key',notScored)+'</div>';
 html+='<div class="analytics-grid"><section class="content-card"><h2>Progress by subject</h2>';
 subjects.forEach(function(s){var qs=BANK.filter(function(q){return q.subject===s;}),done=qs.filter(function(q){return state.answers[q.id]&&state.answers[q.id].answered;}).length,good=qs.filter(function(q){return state.answers[q.id]&&state.answers[q.id].status==='correct';}).length,p=Math.round(done/Math.max(1,qs.length)*100);
 html+='<div class="bar-row"><span>'+esc(s)+'</span><div><div class="bar-track"><i style="width:'+p+'%"></i></div><span class="small-note">'+done+' / '+qs.length+' attempted</span></div><strong>'+p+'%</strong></div>';
 });html+='</section><section class="content-card"><h2>Answer key & review status</h2>'+stat('Bookmarked','Saved questions',state.bookmarks.length)+stat('Flagged','Manually flagged for verification',state.flags.length)+stat('Source-key review','Incomplete source keys',BANK.filter(function(q){return q.answerStatus!=='keyed';}).length)+'<p class="small-note">A source-key match means only that your choices match the answer annotations in the supplied Markdown. It is not a claim of independent correctness.</p></section></div>';
 $('#main').innerHTML=html;setActiveNav();
}
function settingsPage(){
 var html=shellHead('PERSONAL SETTINGS','Settings & data','Everything is stored on this device unless you export it. Core questions remain available offline.','');
 html+='<div class="settings-grid"><section class="content-card"><h2>Reading comfort</h2><p>Adjust the overall text size for easier reading on a phone.</p><div class="settings-actions"><button class="secondary" data-action="font-down">A− Smaller</button><button class="secondary" data-action="font-up">A+ Larger</button><button class="secondary" data-action="theme">Toggle dark mode</button></div><p>Current size: '+state.font+' px · Theme: '+(state.dark?'Dark':'Light')+'</p></section>';
 html+='<section class="content-card"><h2>Export your progress</h2><p>Save bookmarks, flags, settings and your answer history as a JSON file to back it up or move it to another device.</p><div class="settings-actions"><button class="primary" data-action="export-progress">Export progress JSON</button><button class="secondary" data-action="export-bank">Export question bank JSON</button></div></section>';
 html+='<section class="content-card"><h2>Restore a backup</h2><p>Import a previously exported Residency Atlas progress file. This merges saved progress by question ID.</p><div class="settings-actions"><button class="secondary" data-action="import-progress">Choose backup file</button><input type="file" id="importFile" class="file-input" accept=".json,application/json"></div></section>';
 html+='<section class="content-card"><h2>Question source & verification</h2><p>The included Markdown bank is the source of record. Wording, answer labels, topic notes and source appearances are preserved. Missing keys are flagged rather than filled by guesswork.</p><div class="banner-note">Ask ChatGPT shares a structured verification prompt with the ChatGPT app. If the app cannot receive it, the prompt is copied and ChatGPT opens so you can paste it. Google and Guidelines / WHO remain available. Review cited sources and dates before revising your conclusion.</div><p class="small-note">Question data: '+BANK.length+' records · '+uniq('subject').length+' source subjects · local-first, no account required.</p></section></div>';
 $('#main').innerHTML=html;setActiveNav();
}
function exportFile(name,data,mime){
 var content=typeof data==='string'?data:JSON.stringify(data,null,2);
 if(window.Android&&typeof Android.saveTextFile==='function'){Android.saveTextFile(name,content);return;}
 var blob=new Blob([content],{type:mime||'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function verifyLink(src,q){
 var stem=plain(q.stemMarkdown);
 var options=(q.options||[]).map(function(o){return String(o.key||'').toUpperCase()+') '+plain(o.text);});
 var term=stem+' '+options.join(' ')+' answer explanation';
 if(src==='chatgpt'){
  var sourceKey=(q.options||[]).map(function(o){
   var mark='No source answer annotation';
   if(q.questionType==='tf')mark=o.truth===true?'SOURCE MARKS TRUE':o.truth===false?'SOURCE MARKS FALSE':'NOT KEYED / UNKNOWN';
   else if(q.questionType==='sba')mark=o.isBestAnswer?'SOURCE MARKS BEST ANSWER':'Not marked as best answer';
   return String(o.key||'').toUpperCase()+') '+plain(o.text)+' — '+mark;
  }).join('\n');
  var years=(q.years||[]).join(', ')||'Not specified';
  var sessions=(q.sessionBuckets||[]).join(', ')||'Not specified';
  var notes=plain(q.coverageMarkdown||'No separate high-yield topic coverage supplied for this record.');
  var prompt=[
   'You are independently reviewing a medical entrance/residency exam question. Your job is to verify medical correctness, not to defend the supplied answer key.',
   '',
   'IMPORTANT METHOD: First solve the question using only the question stem and options. State your independent answer and reasoning before you look at the source-key annotations placed at the very end of this prompt. Do not treat source annotations as ground truth.',
   '',
   'QUESTION METADATA',
   'Record: '+(q.id||'Not specified'),
   'Subject: '+(q.subject||'Not specified'),
   'Topic/subtopic: '+(q.coverageTitle||'')+(q.subtopic?' / '+q.subtopic:''),
   'Source year(s): '+years,
   'Session/source: '+sessions,
   'Question type: '+(q.questionType==='tf'?'True/False statements':q.questionType==='sba'?'Single best answer':(q.questionType||'Unclassified')),
   '',
   'QUESTION STEM',
   stem||'(No parsed stem available)',
   '',
   'OPTIONS / STATEMENTS — ANSWER BLINDED',
   options.join('\n')||'(No parsed options available)',
   '',
   'REQUIRED ANALYSIS',
   '1. Independently solve first. For True/False, label every statement TRUE or FALSE and give a brief, discriminating rationale for each. For SBA, select one best answer and explain why each plausible distractor is inferior.',
   '2. Then browse the web where available and verify against authoritative sources. Prioritize current clinical guidelines, official public-health guidance, and reputable peer-reviewed reviews or primary literature. Give publication/update dates and direct source URLs/citations.',
   '3. Distinguish established facts from guideline-dependent, context-dependent, outdated, or disputed claims. Do not invent sources or citations. If evidence is insufficient or browsing is unavailable, say so plainly.',
   '4. Only after the independent answer and evidence review, compare with the source-key annotations at the end. Identify each disagreement and explain the most defensible exam-safe answer. Do not silently overwrite or assume the bank key is correct.',
   '5. Keep source-derived information separate from your independent medical assessment.',
   '',
   'HIGH-YIELD TOPIC COVERAGE FROM THE SOURCE RECORD (context only; not an answer key)',
   notes,
   '',
   'SOURCE-KEY ANNOTATIONS — CHECK ONLY AFTER YOUR INDEPENDENT SOLUTION',
   'These labels are copied from the question-bank data and may be incomplete, incorrect, or unverified:',
   sourceKey,
   'Source-key status: '+(q.answerStatus||'Not specified')
  ].join('\n');
  if(window.Android&&typeof Android.askChatGPT==='function'){Android.askChatGPT(prompt);return;}
  if(navigator.clipboard&&navigator.clipboard.writeText){
   navigator.clipboard.writeText(prompt).then(function(){location.href='https://chatgpt.com/';}).catch(function(){window.prompt('Copy this verification prompt, then paste it into ChatGPT.',prompt);});
  }else{
   window.prompt('Copy this verification prompt, then paste it into ChatGPT.',prompt);
  }
  return;
 }
 var url;
 if(src==='guidelines')url='https://www.google.com/search?q='+encodeURIComponent(term+' site:who.int OR site:nice.org.uk OR site:cdc.gov');
 else url='https://www.google.com/search?q='+encodeURIComponent(term);
 if(window.Android&&typeof Android.openUrl==='function')Android.openUrl(url);else location.href=url;
}
function checkAnswer(){
 var q=BANK.find(function(x){return x.id===currentId;});if(!q)return;
 var pick=selected[q.id]||{},complete=false,ok=false,status='unverified';
 if(q.questionType==='tf'){
  complete=q.options.length>0&&q.options.every(function(o){return pick[o.key]===true||pick[o.key]===false;});
  if(complete&&q.answerStatus==='keyed'){ok=q.options.every(function(o){return pick[o.key]===o.truth;});status=ok?'correct':'incorrect';}
 }else if(q.questionType==='sba'){
  complete=!!pick.sba;
  if(complete&&q.answerStatus==='keyed'){ok=q.options.some(function(o){return o.isBestAnswer&&o.key===pick.sba;});status=ok?'correct':'incorrect';}
 }
 if(!complete){alert(q.questionType==='tf'?'Choose True or False for every statement before checking.':'Choose an option before checking.');return;}
 var old=state.answers[q.id]||{};state.answers[q.id]=Object.assign({},old,{answered:true,status:status,choices:Object.assign({},pick),checkedThisView:true,checkedAt:new Date().toISOString()});
 revealed.add(q.id);save();detailQuestion();
}
function doReveal(){if(!currentId)return;revealed.add(currentId);var old=state.answers[currentId]||{};state.answers[currentId]=Object.assign({},old,{revealed:true});save();detailQuestion();}
function openQuestion(id){currentId=id;selected[id]=Object.assign({},(state.answers[id]&&state.answers[id].choices)||{});if(!revealed.has(id)&&state.answers[id]&&state.answers[id].revealed)revealed.add(id);mode=mode||'study';if(queue.length){queuePos=queue.indexOf(id);}detailQuestion();}
function nextQuestion(direction){var qu=queueForPage(),idx=qu.indexOf(currentId),next=qu[idx+(direction||1)];if(next)openQuestion(next);else if(queue.length){alert('Practice queue complete. Your results are saved locally.');page='home';queue=[];homePage();}}
function toggleItem(list,id){var i=list.indexOf(id);if(i>=0)list.splice(i,1);else list.push(id);save();}
function changeFilter(el){var k=el.dataset.filter;if(!k)return;filters[k]=el.value;if(k!=='q')limit=30;if(page==='bookmarks'||page==='mistakes'||page==='verify')listPage();else homePage();}
function render(){if(!BANK.length){$('#main').innerHTML='<div class="empty"><h2>Question bank did not load</h2><p>The bundled question asset is missing or invalid. Run the bank build workflow and check the validator logs.</p></div>';return;}if(page==='question'){detailQuestion();return;}if(page==='home'||page==='practice'){homePage();return;}if(page==='bookmarks'||page==='mistakes'||page==='verify'){listPage();return;}if(page==='analytics'){analyticsPage();return;}if(page==='settings'){settingsPage();return;}homePage();}
document.addEventListener('input',function(e){if(e.target&&e.target.dataset.filter==='q'){filters.q=e.target.value;var pos=e.target.selectionStart;clearTimeout(timer);timer=setTimeout(function(){if(page==='bookmarks'||page==='mistakes'||page==='verify')listPage();else homePage();var x=$('[data-filter="q"]');if(x){x.focus();try{x.setSelectionRange(pos,pos);}catch(err){}}},220);}});
document.addEventListener('change',function(e){if(e.target&&e.target.dataset.filter&&e.target.dataset.filter!=='q')changeFilter(e.target);if(e.target&&e.target.id==='importFile'&&e.target.files&&e.target.files[0]){var f=e.target.files[0],r=new FileReader();r.onload=function(){try{var imp=JSON.parse(r.result);if(!imp||typeof imp!=='object'||!imp.answers)throw new Error('This is not a Residency Atlas progress backup.');state.answers=Object.assign(state.answers,imp.answers||{});state.bookmarks=Array.from(new Set(state.bookmarks.concat(imp.bookmarks||[])));state.flags=Array.from(new Set(state.flags.concat(imp.flags||[])));save();alert('Backup imported.');settingsPage();}catch(err){alert('Could not import backup: '+err.message);}};r.readAsText(f);}});
document.addEventListener('click',function(e){
 var target=e.target.closest('button,[data-open],.option-row.sba');if(!target)return;
 if(target.dataset.filter)return;
 if(target.dataset.open){e.preventDefault();openQuestion(target.dataset.open);return;}
 if(target.dataset.bookmark){e.preventDefault();toggleItem(state.bookmarks,target.dataset.bookmark);if(page==='question')detailQuestion();else render();return;}
 if(target.dataset.flag){e.preventDefault();toggleItem(state.flags,target.dataset.flag);detailQuestion();return;}
 if(target.dataset.tf){var id=target.dataset.qid,k=target.dataset.tf;selected[id]=selected[id]||{};selected[id][k]=target.dataset.value==='true';var q=BANK.find(function(x){return x.id===id;});if(q&&currentId===id)detailQuestion();return;}
 if(target.dataset.sba){var sid=target.dataset.qid||currentId;selected[sid]=selected[sid]||{};selected[sid].sba=target.dataset.sba;detailQuestion();return;}
 if(target.dataset.verifySource){var qv=BANK.find(function(x){return x.id===currentId;});if(qv)verifyLink(target.dataset.verifySource,qv);return;}
 if(target.dataset.status){filters.status=target.dataset.status;limit=30;homePage();return;}
 if(target.dataset.mode){mode=target.dataset.mode;detailQuestion();return;}
 if(target.dataset.action){
  e.preventDefault();var act=target.dataset.action;
  if(act==='home'){setPage('home');return;}
  if(act==='bookmarks'||act==='mistakes'||act==='verify'||act==='analytics'||act==='settings'){setPage(act);return;}
  if(act==='practice'){var items=filtered();queue=items.map(function(q){return q.id;});if(!queue.length){alert('No questions match the current filters.');return;}for(var i=queue.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=queue[i];queue[i]=queue[j];queue[j]=v;}queue=queue.slice(0,Math.min(queue.length,50));currentId=queue[0];selected={};mode='practice';revealed.clear();detailQuestion();return;}
  if(act==='font-up'||act==='font-down'){state.font=Math.max(14,Math.min(25,(state.font||17)+(act==='font-up'?1:-1)));document.documentElement.style.fontSize=state.font+'px';save();if(page==='question')detailQuestion();else render();return;}
  if(act==='theme'){state.dark=!state.dark;document.body.classList.toggle('dark',state.dark);save();return;}
  if(act==='more'){limit+=30;render();return;}
  if(act==='clear-filters'){filters={q:'',year:'',session:'',subject:'',topic:'',subtopic:'',type:'',status:'all',sort:'source'};limit=30;homePage();return;}
  if(act==='clear-search'){filters.q='';if(page==='bookmarks'||page==='mistakes'||page==='verify')listPage();else homePage();return;}
  if(act==='back-results'){if(queue.length){queue=[];}page='home';homePage();return;}
  if(act==='prev-question'){nextQuestion(-1);return;}
  if(act==='next-question'){nextQuestion(1);return;}
  if(act==='check-answer'){checkAnswer();return;}
  if(act==='reveal-answer'){doReveal();return;}
  if(act==='hide-answer'){revealed.delete(currentId);if(state.answers[currentId])state.answers[currentId].revealed=false;selected[currentId]={};if(state.answers[currentId])state.answers[currentId].checkedThisView=false;save();detailQuestion();return;}
  if(act==='toggle-notes'){state.showNotes=!state.showNotes;save();detailQuestion();return;}
  if(act==='save-review'){if(currentId&&!isFlagged(currentId))state.flags.push(currentId);save();detailQuestion();return;}
  if(act==='export-progress'){exportFile('residency-atlas-progress.json',{version:1,exportedAt:new Date().toISOString(),answers:state.answers,bookmarks:state.bookmarks,flags:state.flags,font:state.font,dark:state.dark});return;}
  if(act==='export-bank'){exportFile('residency-atlas-question-bank.json',BANK);return;}
  if(act==='import-progress'){$('#importFile').click();return;}
 }
});
window.handleAndroidBack=function(){if(page==='question'){page='home';queue=[];homePage();return true;}if(page!=='home'){setPage('home');return true;}return false;};
readState();
if(BANK.length){render();}else{$('#main').innerHTML='<div class="empty"><h2>Question bank not bundled</h2><p>Re-run the GitHub Actions build to create questions.js.</p></div>';}
})();