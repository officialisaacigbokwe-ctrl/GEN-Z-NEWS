/* ============================================================
   THE GEN Z NEWS — app.js
   Routing, rendering, and all Supabase (auth + database) calls.
   ============================================================ */

/* ---------- Supabase client ---------- */
const sb = window.supabase.createClient(
  window.GENZ_CONFIG.SUPABASE_URL,
  window.GENZ_CONFIG.SUPABASE_ANON_KEY
);

/* ---------- Static content (not in the database) ---------- */
const SECTIONS = {
  news:    {label:"News & Explainers", desc:"What's happening, broken down — the headline plus the context, so you understand it instead of just scrolling past it."},
  culture: {label:"Culture", desc:"Trends, internet life, identity — the shifts worth naming before they're just \"how things are.\""},
  tech:    {label:"Tech", desc:"AI, apps, and platforms — what's actually changing how you work, learn, and connect."},
  money:   {label:"Money", desc:"Work, income, saving, spending — straight talk with real numbers, no jargon."},
};

const OPPORTUNITIES = [
  {deadline:"Rolling deadline", org:"Climate Now Fellowship", title:"Youth Climate Policy Fellowship",
   desc:"A paid, 10-week remote fellowship for ages 18–25 working on local climate policy briefs."},
  {deadline:"Closes in 3 weeks", org:"Open Grid Labs", title:"Junior Product Design Internship",
   desc:"12-week paid internship for first-time designers building real shipped features."},
  {deadline:"Closes in 6 weeks", org:"First Gen Fund", title:"$5,000 First-Generation Student Grant",
   desc:"No essay required beyond a two-paragraph statement. Open to current undergrads."},
  {deadline:"Ongoing", org:"The Gen Z News", title:"Become a Youth Contributor",
   desc:"Pitch a story, write an explainer, or report from your campus or city. Paid per piece."},
];

const CONTACT_REASONS = [
  {value:"general", label:"General question", desc:"Anything about the site, a correction, or just saying hi."},
  {value:"pitch", label:"Pitch a story", desc:"Tell us the story, why it matters now, and your angle in a few sentences."},
  {value:"opportunity", label:"Submit an opportunity", desc:"A fellowship, internship, or grant worth listing — include the deadline."},
  {value:"partnership", label:"Partnership or press", desc:"Organizations, schools, or press inquiries."},
];

const NAV_ITEMS = [
  {href:"#/section/news", label:"News"},
  {href:"#/section/culture", label:"Culture"},
  {href:"#/section/tech", label:"Tech"},
  {href:"#/section/money", label:"Money"},
  {href:"#/opportunities", label:"Opportunities"},
  {href:"#/community", label:"Community"},
  {href:"#/about", label:"About"},
];

/* ---------- Helpers ---------- */
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function slugify(s){
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
function formatDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
}
function paragraphs(text){
  return String(text || "").split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
}
function sectionTag(key){
  const s = SECTIONS[key] || {label:key};
  return `<span class="tag">${esc(s.label)}</span>`;
}
function app(){ return document.getElementById("app"); }

/* ---------- Auth state ---------- */
let currentUser = null;
let currentProfile = null;

async function loadProfile(){
  if(!currentUser){ currentProfile = null; return; }
  const {data, error} = await sb.from("profiles").select("*").eq("id", currentUser.id).single();
  currentProfile = error ? null : data;
}

async function refreshAuth(){
  const {data:{session}} = await sb.auth.getSession();
  currentUser = session ? session.user : null;
  await loadProfile();
  updateAuthUI();
}

sb.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session ? session.user : null;
  await loadProfile();
  updateAuthUI();
  router();
});

/* ---------- Nav / header ---------- */
function renderNav(){
  const navHtml = NAV_ITEMS.map(i=>`<a href="${i.href}">${i.label}</a>`).join("");
  document.getElementById("navDesktop").innerHTML = navHtml;

  let mobileHtml = navHtml;
  mobileHtml += `<a href="#/contact">Contact us</a>`;
  document.getElementById("mobilePanel").innerHTML = mobileHtml + `<div id="mobileAuthArea"></div>`;
}
renderNav();

function updateAuthUI(){
  const desktop = document.getElementById("authArea");
  const mobile = document.getElementById("mobileAuthArea");
  let html;
  if(currentUser){
    const name = currentProfile ? currentProfile.display_name : currentUser.email;
    const adminLink = currentProfile && currentProfile.is_admin
      ? `<a href="#/admin/new" class="btn">New article</a>` : "";
    html = `${adminLink}<span class="user-chip">Hi, ${esc(name)}</span><button class="btn" id="logoutBtn">Log out</button>`;
  } else {
    html = `<a href="#/login" class="btn">Log in</a><a href="#/signup" class="btn btn-solid">Sign up</a>`;
  }
  if(desktop) desktop.innerHTML = html;
  if(mobile) mobile.innerHTML = html;
  document.querySelectorAll("#logoutBtn").forEach(b=>{
    b.addEventListener("click", async ()=>{ await sb.auth.signOut(); location.hash = "#/"; });
  });
}

document.getElementById("menuBtn").addEventListener("click", ()=>{
  document.getElementById("mobilePanel").classList.toggle("open");
});

/* ---------- Shared bits ---------- */
function storyRow(a){
  return `
    <div class="story-row">
      ${sectionTag(a.section)}
      <div>
        <h3><a href="#/article/${a.slug}">${esc(a.title)}</a></h3>
        <p>${esc(a.dek)}</p>
        <div class="byline"><b>${esc(a.author_name)}</b><span>${esc(a.read_time)}</span><span>${formatDate(a.created_at)}</span></div>
      </div>
    </div>`;
}
function opportunityRow(o){
  return `
    <div class="opp">
      <div class="opp__deadline">${esc(o.deadline)}</div>
      <div class="opp__body">
        <span class="opp__org">${esc(o.org)}</span>
        <h4>${esc(o.title)}</h4>
        <p>${esc(o.desc)}</p>
      </div>
      <a class="opp__cta" href="#/contact">Learn more</a>
    </div>`;
}
function notFound(){
  return `<div class="intro wrap"><h1>Page not found</h1><p>That page doesn't exist. <a href="#/" style="color:var(--gold-deep);font-weight:600;">Back to the homepage →</a></p></div>`;
}
function loadingNote(){
  return `<div class="wrap"><div class="spinner-note">Loading…</div></div>`;
}

/* ---------- Views ---------- */
async function renderHome(token){
  app().innerHTML = loadingNote();
  const {data: latest} = await sb.from("articles").select("*").eq("published", true).order("created_at", {ascending:false}).limit(4);
  if(token !== navToken) return;

  const articles = latest || [];
  const hero = articles[0];
  const side = articles.slice(1, 4);

  const howworks = Object.keys(SECTIONS).map(key=>{
    const s = SECTIONS[key];
    return `
      <div class="howworks__item">
        <span class="tag">${s.label}</span>
        <h3>${s.desc.split(" — ")[0]}</h3>
        <p>${esc(s.desc)}</p>
        <a href="#/section/${key}">Go to ${s.label} →</a>
      </div>`;
  }).join("") + `
      <div class="howworks__item">
        <span class="tag tag--gold">Opportunities</span>
        <h3>Fellowships, internships, grants</h3>
        <p>Vetted opportunities with real deadlines — this is where "what can I actually do" lives.</p>
        <a href="#/opportunities">See open opportunities →</a>
      </div>
      <div class="howworks__item">
        <span class="tag tag--gold">Community</span>
        <h3>Where readers respond</h3>
        <p>Discussion prompts and reader takes — this is where you write, not just read.</p>
        <a href="#/community">Join the conversation →</a>
      </div>`;

  const heroHtml = hero ? `
    <section class="hero">
      <div class="wrap hero__grid">
        <div>
          ${sectionTag(hero.section)}
          <h1 class="hero__headline"><a href="#/article/${hero.slug}">${esc(hero.title)}</a></h1>
          <p class="hero__dek">${esc(hero.dek)}</p>
          <div class="byline"><b>${esc(hero.author_name)}</b><span>${esc(hero.read_time)}</span><span>${formatDate(hero.created_at)}</span></div>
          <div class="why-box">
            <div class="why-box__label">Why it matters</div>
            <p>${esc(hero.why_matters)}</p>
          </div>
        </div>
        <div class="hero__side">
          ${side.map(a=>`
            <div class="side-story">
              ${sectionTag(a.section)}
              <h3><a href="#/article/${a.slug}">${esc(a.title)}</a></h3>
              <p>${esc(a.dek)}</p>
            </div>`).join("") || `<div class="empty-note">More stories will show up here as they're published.</div>`}
        </div>
      </div>
    </section>` : `
    <section class="hero"><div class="wrap">
      <div class="intro" style="padding-top:0;">
        <h1>No articles published yet.</h1>
        <p>${currentProfile && currentProfile.is_admin ? `You're an admin — <a href="#/admin/new" style="color:var(--gold-deep);font-weight:700;">publish the first one →</a>` : "Check back soon."}</p>
      </div>
    </div></section>`;

  app().innerHTML = `
    <section class="howworks">
      <div class="wrap">
        <div class="intro" style="padding-top:0;">
          <h1>Start here.</h1>
          <p>The Gen Z News is organized into six sections. Each one does a specific job — so you always know what you're about to read, and where to go if you want to write something yourself.</p>
        </div>
        <div class="howworks__grid" style="margin-top:26px;">${howworks}</div>
      </div>
    </section>
    ${heroHtml}
    <section class="section">
      <div class="wrap">
        <div class="section__head">
          <div>
            <div class="section__title">Opportunities</div>
            <div class="section__note" style="margin-top:6px;">Fellowships, grants, and roles worth your time.</div>
          </div>
          <a class="section__link" href="#/opportunities">See all opportunities →</a>
        </div>
        <div class="opps">${OPPORTUNITIES.slice(0,2).map(opportunityRow).join("")}</div>
      </div>
    </section>
  `;
}

async function renderSection(key, token){
  const s = SECTIONS[key];
  if(!s){ app().innerHTML = notFound(); return; }
  app().innerHTML = loadingNote();
  const {data} = await sb.from("articles").select("*").eq("published", true).eq("section", key).order("created_at", {ascending:false});
  if(token !== navToken) return;
  const items = data || [];
  app().innerHTML = `
    <section class="intro wrap">
      <span class="tag">${s.label}</span>
      <h1 style="margin-top:14px;">${s.label}</h1>
      <p>${esc(s.desc)}</p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap">
        ${items.length ? `<div class="story-list">${items.map(storyRow).join("")}</div>` : `<div class="empty-note">No stories in this section yet.</div>`}
      </div>
    </section>
  `;
}

function renderOpportunities(){
  app().innerHTML = `
    <section class="intro wrap">
      <span class="tag tag--gold">Opportunities</span>
      <h1 style="margin-top:14px;">Opportunities</h1>
      <p>Fellowships, internships, grants, and roles — vetted, with real deadlines. Know of one we should list? <a href="#/contact" style="color:var(--gold-deep);font-weight:600;">Submit it.</a></p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap"><div class="opps">${OPPORTUNITIES.map(opportunityRow).join("")}</div></div>
    </section>
  `;
}

async function renderCommunity(token){
  app().innerHTML = loadingNote();
  const {data} = await sb.from("community_voices").select("*").order("created_at", {ascending:false}).limit(30);
  if(token !== navToken) return;
  const voices = data || [];

  const formHtml = currentUser ? `
    <div class="form-card" style="max-width:560px;margin-top:32px;">
      <h4>Share your take</h4>
      <form id="voiceForm">
        <div class="field"><label>City (optional)</label><input type="text" id="voiceLoc" maxlength="40"></div>
        <div class="field"><label>Your take</label><textarea id="voiceText" required maxlength="400"></textarea></div>
        <button class="btn-submit" type="submit">Post to Community</button>
        <div class="form-msg" id="voiceMsg"></div>
      </form>
    </div>` : `
    <div class="login-prompt" style="max-width:560px;margin-top:32px;">
      <a href="#/login">Log in</a> or <a href="#/signup">sign up</a> to post your own take.
    </div>`;

  app().innerHTML = `
    <section class="intro wrap">
      <span class="tag tag--gold">Community</span>
      <h1 style="margin-top:14px;">Community</h1>
      <p>Where readers respond, debate, and help shape what we cover next. This week's prompt is below — your answer is posted for other readers to see.</p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap">
        <div class="prompt-box">
          <p class="lead">What's one thing about being young right now that older generations keep getting wrong?</p>
        </div>
        ${voices.length ? `<div class="voices">${voices.map(v=>`
          <div class="voice">
            <p>"${esc(v.body)}"</p>
            <div class="voice__who">${esc(v.author_name)}${v.location ? ` <span>· ${esc(v.location)}</span>` : ""}</div>
          </div>`).join("")}</div>` : `<div class="empty-note">No takes posted yet — be the first.</div>`}
        ${formHtml}
      </div>
    </section>
  `;

  const form = document.getElementById("voiceForm");
  if(form){
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const btn = e.target.querySelector("button");
      const msg = document.getElementById("voiceMsg");
      const loc = document.getElementById("voiceLoc").value.trim();
      const text = document.getElementById("voiceText").value.trim();
      if(!text) return;
      btn.disabled = true;
      const {error} = await sb.from("community_voices").insert({
        user_id: currentUser.id,
        author_name: currentProfile ? currentProfile.display_name : currentUser.email,
        location: loc || null,
        body: text
      });
      if(error){
        msg.textContent = "Couldn't post that — " + error.message;
        msg.className = "form-msg err";
        btn.disabled = false;
      } else {
        renderCommunity(navToken);
      }
    });
  }
}

async function renderArticle(slug, token){
  app().innerHTML = loadingNote();
  const {data: a, error} = await sb.from("articles").select("*").eq("slug", slug).eq("published", true).single();
  if(token !== navToken) return;
  if(error || !a){ app().innerHTML = notFound(); return; }

  const {data: rel} = await sb.from("articles").select("slug,title,section").eq("section", a.section).eq("published", true).neq("slug", slug).order("created_at", {ascending:false}).limit(2);
  if(token !== navToken) return;
  const related = rel || [];

  const isAuthorOrAdmin = currentUser && (currentUser.id === a.author_id || (currentProfile && currentProfile.is_admin));

  app().innerHTML = `
    <article class="article wrap">
      <div class="article__head">
        ${sectionTag(a.section)}
        <h1 class="article__title">${esc(a.title)}</h1>
        <p class="article__dek">${esc(a.dek)}</p>
        <div class="byline"><b>${esc(a.author_name)}</b><span>${esc(a.read_time)}</span><span>${formatDate(a.created_at)}</span></div>
        <div class="article__admin-bar">
          <button class="btn" id="shareBtn" type="button">Share article</button>
          <span class="form-msg ok" id="shareMsg" style="margin:0;"></span>
          ${isAuthorOrAdmin ? `<a class="btn" href="#/admin/edit/${a.slug}">Edit article</a>` : ""}
        </div>
      </div>

      <div class="why-box" style="max-width:68ch;">
        <div class="why-box__label">Why it matters</div>
        <p>${esc(a.why_matters)}</p>
      </div>

      <div class="article__body">
        ${paragraphs(a.body).map(p=>`<p>${esc(p)}</p>`).join("")}
      </div>

      ${related.length ? `
      <div class="related">
        <h4>Read next</h4>
        <div class="related__grid">
          ${related.map(r=>`
            <div class="related__item">
              ${sectionTag(r.section)}
              <h5><a href="#/article/${r.slug}">${esc(r.title)}</a></h5>
            </div>`).join("")}
        </div>
      </div>` : ""}

      <div class="comments">
        <h4>Comments</h4>
        <div class="comment-list" id="commentList"><div class="comment-empty">Loading…</div></div>
        ${currentUser ? `
        <div class="form-card">
          <h4>Add a comment</h4>
          <form id="commentForm">
            <div class="field"><label>Comment</label><textarea id="cText" required maxlength="500"></textarea></div>
            <button class="btn-submit" type="submit">Post comment</button>
            <div class="form-msg" id="cMsg"></div>
          </form>
        </div>` : `<div class="login-prompt"><a href="#/login">Log in</a> or <a href="#/signup">sign up</a> to leave a comment.</div>`}
      </div>
    </article>
  `;

  const shareBtn = document.getElementById("shareBtn");
  if(shareBtn){
    shareBtn.addEventListener("click", async ()=>{
      const shareUrl = location.origin + location.pathname + "#/article/" + slug;
      const shareMsg = document.getElementById("shareMsg");
      if(navigator.share){
        try{
          await navigator.share({title: a.title, text: a.dek, url: shareUrl});
        }catch(e){ /* user cancelled — do nothing */ }
      } else {
        try{
          await navigator.clipboard.writeText(shareUrl);
          shareMsg.textContent = "Link copied!";
          setTimeout(()=>{ if(shareMsg) shareMsg.textContent = ""; }, 2500);
        }catch(e){
          shareMsg.className = "form-msg err";
          shareMsg.textContent = "Couldn't copy — copy the page URL from your address bar instead.";
        }
      }
    });
  }

  async function loadComments(){
    const {data} = await sb.from("comments").select("*").eq("article_slug", slug).order("created_at", {ascending:false}).limit(50);
    if(token !== navToken) return;
    const list = document.getElementById("commentList");
    if(!list) return;
    const docs = data || [];
    list.innerHTML = docs.length ? docs.map(c=>`
      <div class="comment">
        <div class="comment__meta">${esc(c.author_name)} <span>${formatDate(c.created_at)}</span></div>
        <p>${esc(c.body)}</p>
      </div>`).join("") : `<div class="comment-empty">Be the first to comment.</div>`;
  }
  loadComments();

  const cForm = document.getElementById("commentForm");
  if(cForm){
    cForm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const btn = e.target.querySelector("button");
      const msg = document.getElementById("cMsg");
      const text = document.getElementById("cText").value.trim();
      if(!text) return;
      btn.disabled = true;
      const {error} = await sb.from("comments").insert({
        article_slug: slug,
        user_id: currentUser.id,
        author_name: currentProfile ? currentProfile.display_name : currentUser.email,
        body: text
      });
      if(error){
        msg.textContent = "Couldn't post that — " + error.message;
        msg.className = "form-msg err";
        btn.disabled = false;
      } else {
        document.getElementById("cText").value = "";
        msg.textContent = "Comment posted.";
        msg.className = "form-msg ok";
        btn.disabled = false;
        loadComments();
      }
    });
  }
}

function renderContact(){
  app().innerHTML = `
    <section class="intro wrap">
      <h1>Contact us</h1>
      <p>Reach the team directly. Pick the category closest to what you need — it helps us route it to the right person.</p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap contact-grid">
        <div>
          <div class="reason-list">
            ${CONTACT_REASONS.map(r=>`<div class="reason"><h5>${esc(r.label)}</h5><p>${esc(r.desc)}</p></div>`).join("")}
          </div>
        </div>
        <div class="form-card">
          <h4>Send a message</h4>
          <form id="contactForm">
            <div class="form-row2">
              <div class="field"><label>Name</label><input type="text" id="ctName" required maxlength="60" value="${currentProfile ? esc(currentProfile.display_name) : ""}"></div>
              <div class="field"><label>Email</label><input type="email" id="ctEmail" required maxlength="80" value="${currentUser ? esc(currentUser.email) : ""}"></div>
            </div>
            <div class="field">
              <label>Reason</label>
              <select id="ctReason">${CONTACT_REASONS.map(r=>`<option value="${r.value}">${esc(r.label)}</option>`).join("")}</select>
            </div>
            <div class="field"><label>Message</label><textarea id="ctMsg" required maxlength="1000"></textarea></div>
            <button class="btn-submit" type="submit">Send message</button>
            <div class="form-msg" id="ctFormMsg"></div>
          </form>
        </div>
      </div>
    </section>
  `;

  document.getElementById("contactForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const out = document.getElementById("ctFormMsg");
    const name = document.getElementById("ctName").value.trim();
    const email = document.getElementById("ctEmail").value.trim();
    const reason = document.getElementById("ctReason").value;
    const message = document.getElementById("ctMsg").value.trim();
    if(!name || !email || !message) return;
    btn.disabled = true;
    const {error} = await sb.from("contact_messages").insert({name, email, reason, message});
    if(error){
      out.textContent = "Couldn't send that — " + error.message;
      out.className = "form-msg err";
    } else {
      out.textContent = "Message sent — thanks, we'll get back to you.";
      out.className = "form-msg ok";
      e.target.reset();
    }
    btn.disabled = false;
  });
}

function renderAbout(){
  app().innerHTML = `
    <section class="intro wrap">
      <h1>Our mission</h1>
    </section>
    <section class="section" style="border-top:none;padding-top:20px;">
      <div class="wrap">
        <div class="about-body">
          <p>THE GEN Z NEWS is a youth-focused digital media and community platform created to help Gen Z stay informed, think critically, discover opportunities, and engage meaningfully with the world around them.</p>
          <p>It combines news, explainers, current affairs, culture, technology, business, entertainment, ideas, opportunities, and community conversations in formats that fit the way young people consume content today — short, visual, accessible, relevant, and engaging.</p>
          <p>Rather than simply telling young people what happened, THE GEN Z NEWS aims to help them understand why it matters, connect it to their lives, discover what they can do with the information, and become more informed and active participants in the society they are part of.</p>
        </div>
        <div class="related">
          <h4>How the site is organized</h4>
          <div class="howworks__grid" style="margin-top:0;">
            ${Object.keys(SECTIONS).map(key=>{
              const s = SECTIONS[key];
              return `<div class="howworks__item"><span class="tag">${s.label}</span><p style="margin-top:10px;">${esc(s.desc)}</p><a href="#/section/${key}">Go to ${s.label} →</a></div>`;
            }).join("")}
            <div class="howworks__item"><span class="tag tag--gold">Opportunities</span><p style="margin-top:10px;">Fellowships, internships, and grants — vetted, with real deadlines.</p><a href="#/opportunities">See opportunities →</a></div>
            <div class="howworks__item"><span class="tag tag--gold">Community</span><p style="margin-top:10px;">Discussion prompts and reader takes, posted for everyone to see.</p><a href="#/community">Join in →</a></div>
          </div>
        </div>
        <div class="related">
          <h4>Want to write for us?</h4>
          <p style="font-family:var(--font-ui);font-size:15px;color:var(--ink-soft);max-width:60ch;">Pitch a story, write an explainer, or report from your campus or city — contributors are paid per piece. <a href="#/contact" style="color:var(--gold-deep);font-weight:600;">Send a pitch →</a></p>
        </div>
      </div>
    </section>
  `;
}

/* ---------- Auth pages ---------- */
function renderLogin(){
  app().innerHTML = `
    <section class="intro wrap"><h1>Log in</h1></section>
    <section class="section" style="border-top:none;">
      <div class="wrap auth-wrap">
        <div class="form-card">
          <form id="loginForm">
            <div class="field"><label>Email</label><input type="email" id="liEmail" required></div>
            <div class="field"><label>Password</label><input type="password" id="liPass" required></div>
            <button class="btn-submit" type="submit">Log in</button>
            <div class="form-msg" id="liMsg"></div>
          </form>
        </div>
        <div class="auth-switch">No account yet? <a href="#/signup">Sign up</a></div>
      </div>
    </section>
  `;
  document.getElementById("loginForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const msg = document.getElementById("liMsg");
    const email = document.getElementById("liEmail").value.trim();
    const password = document.getElementById("liPass").value;
    btn.disabled = true;
    const {error} = await sb.auth.signInWithPassword({email, password});
    if(error){
      msg.textContent = error.message;
      msg.className = "form-msg err";
      btn.disabled = false;
    } else {
      location.hash = "#/";
    }
  });
}

function renderSignup(){
  app().innerHTML = `
    <section class="intro wrap"><h1>Sign up</h1></section>
    <section class="section" style="border-top:none;">
      <div class="wrap auth-wrap">
        <div class="form-card">
          <form id="signupForm">
            <div class="field"><label>Display name</label><input type="text" id="suName" required maxlength="40"></div>
            <div class="field"><label>Email</label><input type="email" id="suEmail" required></div>
            <div class="field"><label>Password</label><input type="password" id="suPass" required minlength="6"></div>
            <div class="field-hint">At least 6 characters.</div>
            <button class="btn-submit" type="submit" style="margin-top:6px;">Create account</button>
            <div class="form-msg" id="suMsg"></div>
          </form>
        </div>
        <div class="auth-switch">Already have an account? <a href="#/login">Log in</a></div>
      </div>
    </section>
  `;
  document.getElementById("signupForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const msg = document.getElementById("suMsg");
    const display_name = document.getElementById("suName").value.trim();
    const email = document.getElementById("suEmail").value.trim();
    const password = document.getElementById("suPass").value;
    btn.disabled = true;
    const {data, error} = await sb.auth.signUp({email, password, options:{data:{display_name}}});
    if(error){
      msg.textContent = error.message;
      msg.className = "form-msg err";
      btn.disabled = false;
      return;
    }
    if(data.session){
      location.hash = "#/";
    } else {
      msg.textContent = "Account created — check your email to confirm, then log in.";
      msg.className = "form-msg ok";
      btn.disabled = false;
      e.target.reset();
    }
  });
}

/* ---------- Draft autosave (survives tab switches, accidental closes, refreshes) ---------- */
function draftKey(id){ return "genz_draft_" + (id || "new"); }
function loadDraft(key){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function saveDraft(key, data){
  try{ localStorage.setItem(key, JSON.stringify(data)); }catch(e){}
}
function clearDraft(key){
  try{ localStorage.removeItem(key); }catch(e){}
}
function currentFormData(){
  return {
    title: document.getElementById("fTitle").value,
    section: document.getElementById("fSection").value,
    slug: document.getElementById("fSlug").value,
    dek: document.getElementById("fDek").value,
    why_matters: document.getElementById("fWhy").value,
    body: document.getElementById("fBody").value,
    read_time: document.getElementById("fReadTime").value,
    published: document.getElementById("fPublished").checked,
  };
}
function wireDraftAutosave(key){
  const ids = ["fTitle","fSection","fSlug","fDek","fWhy","fBody","fReadTime","fPublished"];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", ()=> saveDraft(key, currentFormData()));
    el.addEventListener("change", ()=> saveDraft(key, currentFormData()));
  });
}

/* ---------- Admin: new / edit article ---------- */
function articleForm(existing){
  const a = existing || {};
  return `
    <form id="articleForm">
      <div class="form-row2">
        <div class="field"><label>Title</label><input type="text" id="fTitle" required value="${esc(a.title||"")}"></div>
        <div class="field"><label>Section</label>
          <select id="fSection">${Object.keys(SECTIONS).map(k=>`<option value="${k}" ${a.section===k?"selected":""}>${SECTIONS[k].label}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>URL slug</label><input type="text" id="fSlug" required value="${esc(a.slug||"")}"><div class="field-hint">Auto-fills from the title. Must be unique.</div></div>
      <div class="field"><label>Dek (one-sentence summary)</label><textarea id="fDek" required maxlength="220">${esc(a.dek||"")}</textarea></div>
      <div class="field"><label>Why it matters</label><textarea id="fWhy" required maxlength="400">${esc(a.why_matters||"")}</textarea></div>
      <div class="field"><label>Body</label><textarea id="fBody" required style="min-height:220px;">${esc(a.body||"")}</textarea><div class="field-hint">Separate paragraphs with a blank line.</div></div>
      <div class="field"><label>Read time (e.g. "5 min read")</label><input type="text" id="fReadTime" value="${esc(a.read_time||"5 min read")}"></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;font-weight:600;"><input type="checkbox" id="fPublished" style="width:auto;" ${a.published===false ? "" : "checked"}> Published</label></div>
      <button class="btn-submit" type="submit">${existing ? "Save changes" : "Publish article"}</button>
      <div class="form-msg" id="fMsg"></div>
    </form>`;
}

function renderAdminNew(){
  if(!(currentProfile && currentProfile.is_admin)){
    app().innerHTML = `<div class="wrap not-authorized">You need admin access to publish articles.</div>`;
    return;
  }
  const key = draftKey("new");
  const draft = loadDraft(key);

  app().innerHTML = `
    <section class="intro wrap">
      <h1>New article</h1>
      <p>This publishes straight to the live site.${draft ? ` <strong style="color:var(--gold-deep);">A saved draft was restored — it autosaves as you type, so switching tabs or closing this one is safe.</strong>` : ` It autosaves as you type — safe to switch tabs (e.g. to copy from Claude) and come back.`}</p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap">
        <div class="form-card" style="max-width:720px;">${articleForm(draft)}</div>
        ${draft ? `<div style="margin-top:14px;"><button class="btn" id="clearDraftBtn" type="button">Discard draft &amp; start over</button></div>` : ""}
      </div>
    </section>
  `;

  const titleEl = document.getElementById("fTitle");
  const slugEl = document.getElementById("fSlug");
  let slugTouched = !!(draft && draft.slug);
  slugEl.addEventListener("input", ()=>{ slugTouched = true; });
  titleEl.addEventListener("input", ()=>{ if(!slugTouched) slugEl.value = slugify(titleEl.value); });

  wireDraftAutosave(key);

  const clearBtn = document.getElementById("clearDraftBtn");
  if(clearBtn){
    clearBtn.addEventListener("click", ()=>{
      clearDraft(key);
      renderAdminNew();
    });
  }

  document.getElementById("articleForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const msg = document.getElementById("fMsg");
    btn.disabled = true;
    const payload = {
      title: document.getElementById("fTitle").value.trim(),
      section: document.getElementById("fSection").value,
      slug: slugify(document.getElementById("fSlug").value),
      dek: document.getElementById("fDek").value.trim(),
      why_matters: document.getElementById("fWhy").value.trim(),
      body: document.getElementById("fBody").value.trim(),
      read_time: document.getElementById("fReadTime").value.trim() || "5 min read",
      published: document.getElementById("fPublished").checked,
      author_id: currentUser.id,
      author_name: currentProfile.display_name,
    };
    const {error} = await sb.from("articles").insert(payload);
    if(error){
      msg.textContent = "Couldn't publish — " + error.message;
      msg.className = "form-msg err";
      btn.disabled = false;
    } else {
      clearDraft(key);
      location.hash = "#/article/" + payload.slug;
    }
  });
}

async function renderAdminEdit(slug, token){
  if(!(currentUser)){
    app().innerHTML = `<div class="wrap not-authorized">Log in to edit this article.</div>`;
    return;
  }
  app().innerHTML = loadingNote();
  const {data: a, error} = await sb.from("articles").select("*").eq("slug", slug).single();
  if(token !== navToken) return;
  if(error || !a){ app().innerHTML = notFound(); return; }
  const allowed = currentUser.id === a.author_id || (currentProfile && currentProfile.is_admin);
  if(!allowed){
    app().innerHTML = `<div class="wrap not-authorized">You don't have permission to edit this article.</div>`;
    return;
  }

  const key = draftKey(a.slug);
  const draft = loadDraft(key);

  app().innerHTML = `
    <section class="intro wrap">
      <h1>Edit article</h1>
      <p>${draft ? `<strong style="color:var(--gold-deep);">Unsaved changes were restored.</strong> ` : ""}Autosaves as you type — safe to switch tabs and come back.</p>
    </section>
    <section class="section" style="border-top:none;">
      <div class="wrap">
        <div class="form-card" style="max-width:720px;">${articleForm(draft || a)}</div>
        <div style="margin-top:18px;display:flex;gap:10px;">
          <button class="mini-btn danger admin-table" id="deleteBtn" style="padding:8px 14px;border:2px solid var(--ink);background:none;font-family:var(--font-ui);font-weight:700;">Delete article</button>
          ${draft ? `<button class="btn" id="clearDraftBtn" type="button">Discard unsaved changes</button>` : ""}
        </div>
      </div>
    </section>
  `;

  wireDraftAutosave(key);

  const clearBtn = document.getElementById("clearDraftBtn");
  if(clearBtn){
    clearBtn.addEventListener("click", ()=>{
      clearDraft(key);
      renderAdminEdit(slug, navToken);
    });
  }

  document.getElementById("articleForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const msg = document.getElementById("fMsg");
    btn.disabled = true;
    const newSlug = slugify(document.getElementById("fSlug").value);
    const payload = {
      title: document.getElementById("fTitle").value.trim(),
      section: document.getElementById("fSection").value,
      slug: newSlug,
      dek: document.getElementById("fDek").value.trim(),
      why_matters: document.getElementById("fWhy").value.trim(),
      body: document.getElementById("fBody").value.trim(),
      read_time: document.getElementById("fReadTime").value.trim() || "5 min read",
      published: document.getElementById("fPublished").checked,
    };
    const {error} = await sb.from("articles").update(payload).eq("id", a.id);
    if(error){
      msg.textContent = "Couldn't save — " + error.message;
      msg.className = "form-msg err";
      btn.disabled = false;
    } else {
      clearDraft(key);
      location.hash = "#/article/" + newSlug;
    }
  });

  document.getElementById("deleteBtn").addEventListener("click", async ()=>{
    if(!confirm("Delete this article? This can't be undone.")) return;
    const {error} = await sb.from("articles").delete().eq("id", a.id);
    if(!error){ clearDraft(key); location.hash = "#/"; }
  });
}

/* ---------- Router ---------- */
let navToken = 0;

async function router(){
  const token = ++navToken;
  document.getElementById("mobilePanel").classList.remove("open");
  const hash = (location.hash || "#/").replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean);
  window.scrollTo(0,0);

  if(parts.length === 0){ await renderHome(token); }
  else if(parts[0] === "section" && parts[1]){ await renderSection(parts[1], token); }
  else if(parts[0] === "article" && parts[1]){ await renderArticle(parts[1], token); }
  else if(parts[0] === "opportunities"){ renderOpportunities(); }
  else if(parts[0] === "community"){ await renderCommunity(token); }
  else if(parts[0] === "contact"){ renderContact(); }
  else if(parts[0] === "about"){ renderAbout(); }
  else if(parts[0] === "login"){ renderLogin(); }
  else if(parts[0] === "signup"){ renderSignup(); }
  else if(parts[0] === "admin" && parts[1] === "new"){ renderAdminNew(); }
  else if(parts[0] === "admin" && parts[1] === "edit" && parts[2]){ await renderAdminEdit(parts[2], token); }
  else { app().innerHTML = notFound(); }

  if(token !== navToken) return;
  let matchHref = null;
  if(parts[0] === "section" && parts[1]) matchHref = "#/section/" + parts[1];
  else if(parts[0]) matchHref = "#/" + parts[0];
  document.querySelectorAll(".masthead__nav a, .mobile-panel a").forEach(el=>{
    el.classList.toggle("active", Boolean(matchHref) && el.getAttribute("href") === matchHref);
  });
}

window.addEventListener("hashchange", router);

/* ---------- Boot ---------- */
(async function boot(){
  await refreshAuth();
  router();
})();
