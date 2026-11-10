import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { auth, db } from './firebase';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp,
} from 'firebase/firestore';

// رسائل التحقق من Firebase تنرسل بالعربي
auth.languageCode = 'ar';

/* ---------- ثوابت ---------- */
const DEFAULT_SUBJECTS = [
  { id: 'operative', name: 'Operative', required: 10 },
  { id: 'endo', name: 'Endodontics', required: 6 },
  { id: 'prostho', name: 'Prosthodontics', required: 5 },
  { id: 'perio', name: 'Periodontics', required: 4 },
  { id: 'surgery', name: 'Oral Surgery', required: 5 },
  { id: 'pedo', name: 'Pediatric Dentistry', required: 6 },
  { id: 'ortho', name: 'Orthodontics', required: 5 },
];
const OLD_AR_NAMES = { operative: 'الترميمية', endo: 'اللب (علاج العصب)', prostho: 'التعويضات', perio: 'اللثة', surgery: 'جراحة الفم', pedo: 'أسنان الأطفال', ortho: 'التقويم' };

const FILLING_CLASSES = ['Composite CL I', 'Composite CL II', 'Composite CL III', 'Composite CL IV', 'Composite CL V'];
const PERIO_LEVELS = ['Mild', 'Moderate', 'Severe'];

const CONDITIONS = [
  { id: 'sound', label: 'Sound', color: '#cfe3e6' },
  { id: 'caries', label: 'Caries', color: '#f5a623' },
  { id: 'filled', label: 'Filled', color: '#2a9d9a' },
  { id: 'missing', label: 'Missing', color: '#b6c5c8' },
  { id: 'rct', label: 'RCT Done', color: '#e0607e' },
  { id: 'crown', label: 'Crown', color: '#4f6bf0' },
  { id: 'fractured', label: 'Fractured', color: '#475569' },
  { id: 'extract', label: 'To Extract', color: '#e5493a' },
];

const PERM_UP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERM_LOW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const PRIM_UP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const PRIM_LOW = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const SHEET_FIELDS = ['name', 'age', 'gender', 'phone', 'address', 'subject', 'date', 'chief', 'presentIllness', 'medicalHistory', 'dentalHistory', 'examination', 'diagnosis', 'fillingClasses', 'perioSeverity', 'calScore'];

const STUDENT_TIMES = ['08:30 صباحاً', '10:30 صباحاً', '12:30 ظهراً'];
const OFF_DAYS = [5]; // الجمعة عطلة فقط
const SUPER_EMAIL = 'wsx67hb@gmail.com';
const SUPPORT_WA = '9647719667763';
const PLANS = ['تجربة مجانية', 'اشتراك شهري', 'اشتراك 3 أشهر', 'اشتراك سنوي'];
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const ICONS = {
  home: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.5 1.8 4.5 4.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6" /></>,
  gear: <><path d="M10.27 4.80 L10.71 1.78 L13.29 1.78 L13.73 4.80 L15.87 5.69 L18.31 3.86 L20.14 5.69 L18.31 8.13 L19.20 10.27 L22.22 10.71 L22.22 13.29 L19.20 13.73 L18.31 15.87 L20.14 18.31 L18.31 20.14 L15.87 18.31 L13.73 19.20 L13.29 22.22 L10.71 22.22 L10.27 19.20 L8.13 18.31 L5.69 20.14 L3.86 18.31 L5.69 15.87 L4.80 13.73 L1.78 13.29 L1.78 10.71 L4.80 10.27 L5.69 8.13 L3.86 5.69 L5.69 3.86 L8.13 5.69 Z" /><circle cx="12" cy="12" r="3.2" /></>,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  box: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
};
function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

/* ---------- أدوات ---------- */
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid8 = () => Math.random().toString(36).slice(2, 10);
const toAr = (s) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pickSheet = (c) => { const o = {}; SHEET_FIELDS.forEach((k) => { o[k] = c[k] ?? (k === 'fillingClasses' ? [] : ''); }); return o; };
const caseDetail = (c) => {
  if (c.subject === 'operative' && (c.fillingClasses || []).length) return c.fillingClasses.join(' + ');
  if (c.subject === 'perio' && (c.perioSeverity || c.calScore)) return [c.perioSeverity, c.calScore !== '' && c.calScore != null ? 'CAL ' + c.calScore : ''].filter(Boolean).join(' · ');
  return '';
};
const slotId = (sid, date, time) => `${sid}_${date}_${STUDENT_TIMES.indexOf(time)}`;
const nextDays = (n) => {
  const out = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 1; out.length < n && i < 60; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i);
    if (OFF_DAYS.includes(x.getDay())) continue;
    out.push({ date: fmt(x), day: WEEKDAYS[x.getDay()], label: `${x.getDate()}/${x.getMonth() + 1}` });
  }
  return out;
};

const latinDigits = (v) => String(v || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const telNumber = (v) => latinDigits(v).replace(/[^\d+]/g, '');
const waNumber = (v) => {
  let d = latinDigits(v).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '964' + d.slice(1);
  else if (d.length === 10 && d.startsWith('7')) d = '964' + d;
  return d;
};
const normIraqPhone = (v) => {
  let d = latinDigits(v).replace(/\D/g, '');
  if (d.startsWith('00964')) d = d.slice(5); else if (d.startsWith('964')) d = d.slice(3);
  if (d.length === 10 && d.startsWith('7')) d = '0' + d;
  return /^07\d{9}$/.test(d) ? d : '';
};

const authError = (code) => ({
  'auth/invalid-email': 'الإيميل غير صحيح',
  'auth/missing-password': 'اكتب كلمة المرور',
  'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
  'auth/email-already-in-use': 'هذا الإيميل مسجّل من قبل، جرّب تسجيل الدخول',
  'auth/invalid-credential': 'الإيميل أو كلمة المرور غير صحيحة',
  'auth/user-not-found': 'الإيميل أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'الإيميل أو كلمة المرور غير صحيحة',
  'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً وجرّب مرة ثانية',
  'auth/network-request-failed': 'تأكد من الإنترنت',
}[code] || 'صار خطأ، جرّب مرة ثانية');

let confirmHost = null;
const askConfirm = (message, okLabel = 'تأكيد') => new Promise((resolve) => {
  if (confirmHost) confirmHost({ message, okLabel, resolve }); else resolve(window.confirm(message));
});
function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => { confirmHost = setReq; return () => { confirmHost = null; }; }, []);
  if (!req) return null;
  const done = (v) => { req.resolve(v); setReq(null); };
  return (
    <div className="dialog-ov" onClick={() => done(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <p>{req.message}</p>
        <div className="row">
          <button className="btn ghost grow" onClick={() => done(false)}>إلغاء</button>
          <button className="btn danger grow" onClick={() => done(true)}>{req.okLabel}</button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="center">
        <div className="card stack" style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={80} /></div>
          <h2>صار شي غير متوقع</h2>
          <p className="muted bold">بياناتك محفوظة ولا شي ضاع. اضغط إعادة التحميل وكمّل شغلك.</p>
          <button className="btn block" onClick={() => window.location.reload()}>إعادة التحميل</button>
          <p className="hint ltr" style={{ wordBreak: 'break-word' }}>{String((this.state.err && this.state.err.message) || '')}</p>
        </div>
      </div>
    );
  }
}

function Splash() {
  return (
    <div className="center">
      <div style={{ textAlign: 'center' }}>
        <div className="pulse"><Logo size={96} /></div>
        <p className="hint" style={{ marginTop: 14 }}>جاري التحميل...</p>
      </div>
    </div>
  );
}

function Confetti({ msg }) {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2 + Math.random() * 1.5, e: ['🎉', '✨', '🦷', '⭐', '🎊'][i % 5] })), []);
  return (
    <div className="confetti">
      <div className="party-msg">{msg}</div>
      {bits.map((b, i) => <span key={i} style={{ left: b.left + '%', animationDelay: b.delay + 's', animationDuration: b.dur + 's' }}>{b.e}</span>)}
    </div>
  );
}

function Ring({ value, max, size = 76 }) {
  const r = 22, c = 2 * Math.PI * r;
  const pct = max ? Math.min(value / max, 1) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <span style={{ fontSize: size * 0.2 }}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

function Progress({ value, max }) {
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 9, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#348a69,#3ec3b2)', borderRadius: 99, transition: 'width .4s' }} />
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="head"><h2>{title}</h2><button className="x" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

function WeekChart({ data }) {
  const max = Math.max(1, ...data);
  const W = 300, H = 90;
  const pts = data.map((v, i) => [(i * (W - 20)) / (data.length - 1) + 10, H - 14 - (v / max) * (H - 34)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', direction: 'ltr' }}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--brand)" />)}
      {pts.map((p, i) => data[i] > 0 ? <text key={'t' + i} x={p[0]} y={p[1] - 8} fontSize="9" textAnchor="middle" fill="var(--muted)">{data[i]}</text> : null)}
    </svg>
  );
}

const weeklyCounts = (cases) => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const buckets = Array(8).fill(0);
  cases.forEach((c) => (c.visits || []).forEach((v) => {
    if (!v.date) return;
    const diff = Math.floor((now.getTime() - new Date(v.date + 'T00:00:00').getTime()) / 86400000);
    if (diff < 0 || diff >= 56) return;
    buckets[7 - Math.floor(diff / 7)] += 1;
  }));
  return buckets;
};

function Logo({ size = 48 }) {
  return <img src="/logo.png" alt="Sestemy College" width={size} height={size} style={{ width: size, height: size, borderRadius: size * 0.32, objectFit: 'cover', flexShrink: 0 }} />;
}

function Brand({ size = 48 }) {
  return (
    <div className="brand">
      <Logo size={size} />
      <div><b>sestemy</b><small>COLLEGE</small></div>
    </div>
  );
}

/* ---------- تسجيل الدخول ---------- */
function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === 'register') {
        if (!name.trim()) { setErr('اكتب اسمك'); setBusy(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'students', cred.user.uid), { name: name.trim(), email: email.trim(), university: '', subjects: DEFAULT_SUBJECTS, createdAt: Date.now() }, { merge: true });
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('أرسلنا رسالة تحقق إلى إيميلك. افتح الرابط وغيّر كلمة المرور (تفقد Spam إذا ما وصلت).');
      }
    } catch (e2) { setErr(authError(e2.code)); }
    setBusy(false);
  };

  return (
    <div className="center">
      <form className="card stack" style={{ width: '100%', maxWidth: 400 }} onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={104} /></div>
          <div className="brand" style={{ justifyContent: 'center', marginTop: 10 }}><div style={{ textAlign: 'center' }}><b style={{ fontSize: 28 }}>sestemy</b><small>COLLEGE</small></div></div>
          <p className="hint" style={{ marginTop: 8 }}>سجلّك السريري كله بمكان واحد</p>
        </div>
        {mode === 'register' && (
          <label className="field"><span>الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        )}
        <label className="field"><span>الإيميل</span><input className="input ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        {mode !== 'reset' && (
          <label className="field"><span>كلمة المرور</span><input className="input ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        )}
        {err && <div className="msg err">{err}</div>}
        {info && <div className="msg ok">{info}</div>}
        <button className="btn block" disabled={busy}>{busy ? '...' : mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء حساب' : 'إرسال الرابط'}</button>
        <div className="row between wrap small">
          {mode === 'login' ? (
            <>
              <button type="button" className="link" onClick={() => { setMode('register'); setErr(''); }}>حساب جديد</button>
              <button type="button" className="link" onClick={() => { setMode('reset'); setErr(''); }}>نسيت كلمة المرور؟</button>
            </>
          ) : (
            <button type="button" className="link" onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>رجوع لتسجيل الدخول</button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------- صفحة الحجز العامة ---------- */
function PublicBooking({ id }) {
  const [info, setInfo] = useState(undefined);
  const [taken, setTaken] = useState([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const days = useMemo(() => nextDays(12), []);

  const load = async () => {
    try {
      const s = await getDoc(doc(db, 'public_students', id));
      if (!s.exists()) { setInfo(null); return; }
      setInfo(s.data());
      const q = await getDocs(query(collection(db, 'public_slots'), where('studentId', '==', id)));
      setTaken(q.docs.map((d) => d.id));
    } catch (e) { setInfo(null); }
  };
  useEffect(() => { load(); }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!date || !time) { setErr('اختر اليوم والوقت'); return; }
    if (!name.trim()) { setErr('اكتب اسمك'); return; }
    const ph = normIraqPhone(phone);
    if (!ph) { setErr('اكتب رقم هاتفك مثل 07701234567'); return; }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'public_slots', slotId(id, date, time)), { studentId: id, date, time });
      batch.set(doc(collection(db, 'public_bookings')), { studentId: id, name: name.trim(), phone: ph, date, time, note: note.trim(), status: 'pending', createdAt: new Date().toISOString() });
      await batch.commit();
      setDone(true);
    } catch (e2) {
      setErr('هذا الوقت انحجز قبل لحظات، اختر وقتاً ثانياً');
      setTime(''); load();
    }
    setBusy(false);
  };

  if (info === undefined) return <Splash />;
  if (info === null) return <div className="center"><div className="card empty" style={{ maxWidth: 380 }}>رابط الحجز غير صحيح أو غير متوفر حالياً</div></div>;

  if (done) {
    return (
      <div className="center"><div className="card stack" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>تم إرسال طلب الحجز</h2>
        <p className="muted bold">طلبك وصل للطالب {info.name}. سيتواصل معك على الرقم الذي كتبته لتأكيد الموعد.</p>
        <p className="hint">{date} · {time}</p>
      </div></div>
    );
  }

  return (
    <div className="app stack">
      <div className="topbar"><Brand /></div>
      <div className="hero">
        <div className="greet">🦷 حجز موعد علاج عند طالب طب أسنان</div>
        <h1>{info.name}</h1>
        <div className="date">{info.university || 'طالب طب أسنان'}</div>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="card stack">
          <h3>اختر اليوم</h3>
          <div className="chips">
            {days.map((d) => (
              <button type="button" key={d.date} className={'daybtn' + (date === d.date ? ' on' : '')} onClick={() => { setDate(d.date); setTime(''); }}>
                <small>{d.day}</small><b>{d.label}</b>
              </button>
            ))}
          </div>
          {date && (
            <>
              <h3>اختر الوقت</h3>
              <div className="grid3">
                {STUDENT_TIMES.map((t) => {
                  const isTaken = taken.includes(slotId(id, date, t));
                  return <button type="button" key={t} disabled={isTaken} className={'timebtn' + (time === t ? ' on' : '')} onClick={() => setTime(t)}>{t}{isTaken ? <small>محجوز</small> : null}</button>;
                })}
              </div>
            </>
          )}
        </div>
        <div className="card stack">
          <label className="field"><span>اسمك</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field"><span>رقم الهاتف</span><input className="input ltr" inputMode="tel" maxLength={24} placeholder="07701234567" value={phone} onChange={(e) => setPhone(latinDigits(e.target.value))} autoComplete="tel" /><span className="hint" style={{ display: 'block', marginTop: 5 }}>اكتب رقمك مثل 07701234567، بدون مفتاح الدولة</span></label>
          <label className="field"><span>شنو مشكلتك؟ (اختياري)</span><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: ألم بالضرس السفلي" /></label>
          {err && <div className="msg err">{err}</div>}
          <button className="btn block" disabled={busy}>{busy ? '...' : 'إرسال طلب الحجز'}</button>
          <p className="hint" style={{ textAlign: 'center' }}>الحجز طلب ويحتاج تأكيد من الطالب.</p>
        </div>
      </form>
    </div>
  );
}

/* ---------- خريطة الأسنان ---------- */
const PERM_POS = {
  18: [335, 408], 17: [334, 325], 16: [362, 252], 15: [410, 185], 14: [460, 145], 13: [517, 115], 12: [570, 98], 11: [620, 88],
  21: [693, 90], 22: [750, 98], 23: [805, 115], 24: [862, 145], 25: [912, 187], 26: [958, 247], 27: [987, 327], 28: [985, 408],
  48: [357, 487], 47: [348, 567], 46: [369, 650], 45: [412, 712], 44: [462, 755], 43: [516, 783], 42: [570, 803], 41: [626, 812],
  31: [693, 812], 32: [750, 803], 33: [805, 783], 34: [860, 755], 35: [910, 712], 36: [950, 650], 37: [973, 567], 38: [965, 487],
};
const TOOTH_DIM = { i: [52, 38, 16], c: [54, 46, 20], p: [56, 54, 19], m: [72, 72, 22] };
const toothType = (n, perm) => { const u = n % 10; if (u <= 2) return 'i'; if (u === 3) return 'c'; if (perm) return u <= 5 ? 'p' : 'm'; return 'm'; };

function Odontogram({ dent, teeth, selected, onPick }) {
  const perm = dent === 'permanent';
  const upN = perm ? PERM_UP : PRIM_UP;
  const lowN = perm ? PERM_LOW : PRIM_LOW;
  const U = perm ? { cx: 660, cy: 408, rx: 325, ry: 320 } : { cx: 660, cy: 420, rx: 270, ry: 268 };
  const L = perm ? { cx: 660, cy: 487, rx: 304, ry: 325 } : { cx: 660, cy: 470, rx: 256, ry: 272 };

  const place = (nums, arch, upper) => nums.map((n, i) => {
    let x, y;
    if (perm) { [x, y] = PERM_POS[n]; } else {
      const a = Math.PI - ((i + 0.5) * Math.PI) / nums.length;
      x = arch.cx + arch.rx * Math.cos(a);
      y = upper ? arch.cy - arch.ry * Math.sin(a) : arch.cy + arch.ry * Math.sin(a);
    }
    const vx = x - arch.cx, vy = y - arch.cy;
    const len = Math.hypot(vx, vy) || 1;
    return { n, x, y, nx: vx / len, ny: vy / len };
  });
  const all = [...place(upN, U, true), ...place(lowN, L, false)];
  const sc = perm ? 1 : 1.12;

  const renderTooth = ({ n, x, y, nx, ny }) => {
    const [w0, h0, r0] = TOOTH_DIM[toothType(n, perm)];
    const w = w0 * sc, h = h0 * sc, r = r0 * sc;
    const rot = (Math.atan2(-nx, ny) * 180) / Math.PI;
    const t = teeth[n];
    const cond = t ? t.condition : 'sound';
    const cd = CONDITIONS.find((c) => c.id === cond) || CONDITIONS[0];
    const type = toothType(n, perm);
    const sel = String(selected) === String(n);
    const missing = cond === 'missing';
    let stroke = '#a8c8cb', fill = '#eef7f7', sw = 2.5;
    if (cond === 'crown') { stroke = cd.color; fill = '#dbe3ff'; sw = 3.5; }
    if (cond === 'extract') { stroke = cd.color; sw = 3.5; }
    if (cond === 'fractured') { stroke = cd.color; sw = 3.5; }
    const mark = '#b7cfd2';
    const slash = x < 660 ? [-8, 8, 8, -8] : [8, 8, -8, -8];
    return (
      <g key={n} onClick={() => onPick(n)} style={{ cursor: 'pointer' }}>
        <text x={x + nx * (h / 2 + 34)} y={y + ny * (h / 2 + 34)} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="var(--muted)" style={{ pointerEvents: 'none' }}>{n}</text>
        <g transform={`translate(${x} ${y}) rotate(${rot})`}>
          <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx={r + 4} fill="transparent" />
          {!missing && <rect x={-w / 2} y={-h / 2 + 4} width={w} height={h} rx={r} fill="rgba(11,59,58,.10)" />}
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} fill={missing ? 'none' : fill} stroke={stroke} strokeWidth={sw} strokeDasharray={missing ? '6 5' : undefined} opacity={missing ? 0.75 : 1} />
          {(type === 'm') && cond !== 'extract' && <g stroke={mark} strokeWidth="2.5" strokeLinecap="round" opacity={missing ? 0.6 : 1}><path d="M-13 0H13M0 -13V13" /></g>}
          {(type === 'p') && !t && <path d={`M${slash[0]} ${slash[1]}L${slash[2]} ${slash[3]}`} stroke={mark} strokeWidth="2.5" strokeLinecap="round" />}
          {(type === 'p') && t && cond === 'sound' && <path d={`M${slash[0]} ${slash[1]}L${slash[2]} ${slash[3]}`} stroke={mark} strokeWidth="2.5" strokeLinecap="round" />}
          {cond === 'caries' && <circle r="9" fill={cd.color} stroke="#fff" strokeWidth="2" />}
          {cond === 'filled' && <rect x="-13" y="-8" width="26" height="16" rx="8" fill={cd.color} />}
          {cond === 'rct' && <><circle r="14" fill="none" stroke={cd.color} strokeWidth="2.5" strokeDasharray="3 3" /><circle r="8" fill={cd.color} /></>}
          {cond === 'fractured' && <path d="M-9 -15L-2 -3L-9 4L1 16" fill="none" stroke={cd.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
          {cond === 'extract' && <path d="M-15 -15L15 15M15 -15L-15 15" stroke={cd.color} strokeWidth="5" strokeLinecap="round" />}
          {sel && <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx={r + 5} fill="none" stroke="var(--brand)" strokeWidth="4" />}
          {t && hasToothInfo(t) ? <circle cx={w / 2 - 4} cy={-h / 2 + 4} r="6" fill="var(--brand)" stroke="#fff" strokeWidth="2" /> : null}
        </g>
      </g>
    );
  };

  const arc = (c, upper) => (upper
    ? `M ${c.cx - c.rx} ${c.cy} A ${c.rx} ${c.ry} 0 0 1 ${c.cx + c.rx} ${c.cy}`
    : `M ${c.cx - c.rx} ${c.cy} A ${c.rx} ${c.ry} 0 0 0 ${c.cx + c.rx} ${c.cy}`);

  return (
    <div style={{ background: 'var(--solid)', borderRadius: 28, padding: 6 }}>
      <svg viewBox="190 10 940 890" style={{ width: '100%', display: 'block', direction: 'ltr' }}>
        <path d={arc(U, true)} fill="none" stroke="rgba(244,150,150,.22)" strokeWidth={perm ? 118 : 130} strokeLinecap="round" />
        <path d={arc(L, false)} fill="none" stroke="rgba(244,150,150,.22)" strokeWidth={perm ? 118 : 130} strokeLinecap="round" />
        <text x="660" y="432" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--muted)" letterSpacing="7">UPPER</text>
        <line x1="515" y1="466" x2="805" y2="466" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 7" opacity=".6" />
        <text x="660" y="508" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--muted)" letterSpacing="7">LOWER</text>
        <text x="232" y="474" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--muted)">R</text>
        <text x="1088" y="474" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--muted)">L</text>
        {all.map(renderTooth)}
      </svg>
    </div>
  );
}

const CANAL_SUGGEST = ['MB', 'MB2', 'DB', 'P', 'ML', 'M', 'D', 'B', 'L'];
const canalSummary = (t) => (t.canalList && t.canalList.length ? t.canalList.map((x) => (x.name || '—') + (x.wl ? ' ' + x.wl + 'mm' : '')).join(', ') : (t.wl ? 'WL ' + t.wl + 'mm' : ''));
const toothExtra = (t) => [t.vitality, canalSummary(t), t.restorations && t.restorations.length ? t.restorations.join(' + ') : ''].filter(Boolean).join(' · ');
const hasToothInfo = (t) => !!(t.notes || t.vitality || t.wl || (t.canalList && t.canalList.length) || (t.restorations && t.restorations.length));

function PopupPicker({ options, value, onChange, multi, placeholder, title, openSignal, allowCustom }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const sel = multi ? (value || []) : (value ? [value] : []);
  const rank = (x) => { const i = options.indexOf(x); return i < 0 ? 999 : i; };
  const toggle = (o) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o].sort((a, b) => rank(a) - rank(b)));
  const remove = (o) => onChange(multi ? sel.filter((x) => x !== o) : '');
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!sel.includes(v)) onChange([...sel, v].sort((a, b) => rank(a) - rank(b)));
    setCustom('');
  };
  const listed = [...options, ...sel.filter((x) => !options.includes(x))];
  return (
    <div className="picker">
      <div className="picked">
        {sel.map((o) => (
          <span key={o} className="pchip">{o}<button type="button" aria-label={'إزالة ' + o} onClick={() => remove(o)}>✕</button></span>
        ))}
        <button type="button" className="pickbtn" onClick={() => setOpen(!open)}>{sel.length === 0 ? (placeholder || 'اختر...') : multi ? 'تعديل الأنواع' : 'تغيير'} ▾</button>
      </div>
      {!multi && open && (
        <div className="menu">
          {options.filter((o) => o !== value).map((o) => <button type="button" key={o} className="mi" onClick={() => { onChange(o); setOpen(false); }}>{o}</button>)}
        </div>
      )}
      {multi && open && createPortal(
        <div className="pick-ov" onClick={() => setOpen(false)}>
          <div className="pick-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="head"><h2>{title || 'اختر الأنواع'}</h2><button type="button" className="x" onClick={() => setOpen(false)}>✕</button></div>
            <p className="hint" style={{ marginBottom: 6 }}>اضغط على الأنواع لاختيارها أو إلغائها، تكدر تختار أكثر من نوع{allowCustom ? '، أو تكتب نوع ثاني' : ''}</p>
            {listed.map((o) => (
              <button type="button" key={o} className={'opt' + (sel.includes(o) ? ' on' : '')} onClick={() => toggle(o)}>
                <span className="box">{sel.includes(o) ? '✓' : ''}</span>{o}
              </button>
            ))}
            {allowCustom && (
              <div className="row" style={{ marginTop: 12 }}>
                <input className="input grow ltr" value={custom} placeholder="اكتب نوعاً آخر (مثلاً Amalgam)" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
                <button type="button" className="btn soft" onClick={addCustom}>＋ إضافة</button>
              </div>
            )}
            <button type="button" className="btn block" style={{ marginTop: 14 }} onClick={() => setOpen(false)}>تم ({sel.length})</button>
          </div>
        </div>, document.body)}
    </div>
  );
}

const lockKey = (uid) => 'sc_lock_' + uid;
const getLock = (uid) => { try { return JSON.parse(localStorage.getItem(lockKey(uid)) || 'null'); } catch (e) { return null; } };
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => { let x = str.replace(/-/g, '+').replace(/_/g, '/'); while (x.length % 4) x += '='; return Uint8Array.from(atob(x), (ch) => ch.charCodeAt(0)); };
const lockSupported = async () => {
  try { return !!(window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
};
const lockEnroll = async (uid, email) => {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Sestemy College' },
      user: { id: new TextEncoder().encode(uid.slice(0, 60)), name: email || uid, displayName: email || uid },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none',
    },
  });
  return b64u(cred.rawId);
};
const lockVerify = async (id) => {
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: unb64u(id), transports: ['internal'] }],
      userVerification: 'required', timeout: 60000,
    },
  });
  return true;
};

function AppLockScreen({ uid, onUnlock }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    const cfg = getLock(uid);
    if (!cfg) { onUnlock(); return; }
    setBusy(true); setMsg('');
    try { await lockVerify(cfg.id); onUnlock(); } catch (e) { setMsg('ما تم التحقق، جرّب مرة ثانية'); }
    setBusy(false);
  };
  useEffect(() => { unlock(); }, []);
  return (
    <div className="center">
      <div className="card stack" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={92} /></div>
        <h2>التطبيق مقفل 🔒</h2>
        <p className="muted bold">استخدم Face ID أو بصمتك أو رمز الجهاز لفتح التطبيق</p>
        {msg && <div className="msg err">{msg}</div>}
        <button className="btn block" onClick={unlock} disabled={busy}>{busy ? '...' : 'فتح القفل'}</button>
        <button className="btn ghost block" onClick={() => { try { localStorage.removeItem(lockKey(uid)); } catch (e) {} signOut(auth); }}>تسجيل الخروج</button>
      </div>
    </div>
  );
}

function SubjectFields({ subject, v, set }) {
  if (subject === 'operative') {
    return (
      <div className="stack">
        <h3>Restoration Type</h3>
        <p className="hint">اختر نوع واحد أو أكثر، أو اكتب نوعاً ثانياً، وتكدر تمسح أي نوع بعلامة ✕</p>
        <PopupPicker multi allowCustom options={FILLING_CLASSES} value={v.fillingClasses || []} onChange={(val) => set('fillingClasses', val)} placeholder="اختر نوع الحشوة" />
      </div>
    );
  }
  if (subject === 'perio') {
    return (
      <div className="stack">
        <h3>Periodontal Status</h3>
        <PopupPicker options={PERIO_LEVELS} value={v.perioSeverity || ''} onChange={(val) => set('perioSeverity', val)} placeholder="اختر التصنيف" />
        <label className="field"><span>CAL Scores</span>
          <input className="input ltr" type="number" inputMode="decimal" step="0.5" min="0" value={v.calScore ?? ''} onChange={(e) => set('calScore', e.target.value)} placeholder="0" />
        </label>
      </div>
    );
  }
  return null;
}

const loadImg = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = reject;
  r.onload = (e) => { const img = new Image(); img.onerror = reject; img.onload = () => resolve(img); img.src = e.target.result; };
  r.readAsDataURL(file);
});
const shrink = (img, max, q) => {
  let w = img.width, h = img.height;
  if (w > h) { if (w > max) { h = Math.round((h * max) / w); w = max; } } else if (h > max) { w = Math.round((w * max) / h); h = max; }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { url: c.toDataURL('image/jpeg', q), w, h };
};
const compressPhoto = async (file) => {
  const img = await loadImg(file);
  let max = 1200, q = 0.85;
  let out = shrink(img, max, q);
  while (out.url.length > 700000 && q > 0.5) { q -= 0.1; if (q < 0.7) max = 1000; out = shrink(img, max, q); }
  if (out.url.length > 900000) throw new Error('too-big');
  return { full: out.url, thumb: shrink(img, 260, 0.7).url, w: out.w, h: out.h };
};

const PHOTO_KINDS = ['Before', 'After', 'X-Ray', 'Other'];
const MAX_PHOTOS = 30;

function PhotosTab({ c, uid, flash }) {
  const [photos, setPhotos] = useState([]);
  const [kind, setKind] = useState('Before');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [full, setFull] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'case_photos'), where('studentId', '==', uid), where('caseId', '==', c.id));
    return onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, () => {});
  }, [uid, c.id]);

  const add = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { flash(`الحد الأقصى ${MAX_PHOTOS} صورة لكل حالة`); return; }
    setBusy(true);
    let ok = 0;
    for (const f of files) {
      try {
        const p = await compressPhoto(f);
        const id = doc(collection(db, 'case_photos')).id;
        const batch = writeBatch(db);
        batch.set(doc(db, 'case_photos', id), { studentId: uid, caseId: c.id, kind, thumb: p.thumb, w: p.w, h: p.h, date: todayStr(), createdAt: Date.now() });
        batch.set(doc(db, 'case_photos_full', id), { studentId: uid, caseId: c.id, data: p.full });
        await batch.commit();
        ok += 1;
      } catch (err) { flash('تعذر رفع إحدى الصور'); }
    }
    setBusy(false);
    if (ok) flash(`تمت إضافة ${ok} صورة ✓`);
  };

  const open = async (p) => {
    setView(p); setFull('');
    try { const s2 = await getDoc(doc(db, 'case_photos_full', p.id)); if (s2.exists()) setFull(s2.data().data); } catch (err) {}
  };
  const del = async (p) => {
    if (!(await askConfirm('حذف هذه الصورة؟', 'حذف'))) return;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'case_photos', p.id)); b.delete(doc(db, 'case_photos_full', p.id));
      await b.commit(); setView(null);
    } catch (err) { flash('ما انحذفت'); }
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h3>إضافة صور</h3>
        <div className="chipsel">
          {PHOTO_KINDS.map((k) => <button type="button" key={k} className={'selchip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{k}</button>)}
        </div>
        <label className="btn block" style={{ cursor: 'pointer' }}>
          {busy ? 'جاري الضغط والرفع...' : '＋ اختيار صور / تصوير'}
          <input type="file" accept="image/*" multiple disabled={busy} onChange={add} style={{ display: 'none' }} />
        </label>
        <p className="hint">تُضغط الصور تلقائياً (حتى 1200px) للحفاظ على المساحة مع بقاء الوضوح. الحد الأقصى {MAX_PHOTOS} صورة للحالة.</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>الصور ({photos.length})</h3>
        {photos.length === 0 ? <div className="empty">ما موجودة صور بعد</div> : (
          <div className="pgrid">
            {photos.map((p) => (
              <button key={p.id} className="pth" onClick={() => open(p)}>
                <img src={p.thumb} alt={p.kind} loading="lazy" />
                <span>{p.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view && (
        <div className="viewer" onClick={() => setView(null)}>
          <img src={full || view.thumb} alt={view.kind} onClick={(e) => e.stopPropagation()} style={{ opacity: full ? 1 : 0.6 }} />
          <div className="row wrap" onClick={(e) => e.stopPropagation()} style={{ color: '#fff', fontWeight: 800, justifyContent: 'center' }}>
            <span>{view.kind} · {view.date}</span>
            {full ? <a className="btn soft small" href={full} download={`photo-${view.date}-${view.id.slice(0, 5)}.jpg`}>تحميل</a> : null}
            <button className="btn danger small" onClick={() => del(view)}>حذف</button>
            <button className="btn ghost small" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} onClick={() => setView(null)}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseDetail({ c, subjects, onBack, save, remove, flash, onNewSheet, doneInfo, celebrate }) {
  const [tab, setTab] = useState('sheet');
  const [d, setD] = useState(() => pickSheet(c));
  const [dirty, setDirty] = useState(false);
  const verRef = useRef(0);
  const [auto, setAuto] = useState('');
  const [dent, setDent] = useState('permanent');
  const [tooth, setTooth] = useState(null);
  const [cond, setCond] = useState('sound');
  const [notes, setNotes] = useState('');
  const [tv, setTv] = useState('');
  const [tcanals, setTcanals] = useState([]);
  const [trest, setTrest] = useState([]);
  const [pickSignal, setPickSignal] = useState(0);
  const [tcurv, setTcurv] = useState('');
  const [tobt, setTobt] = useState('');
  const [vDate, setVDate] = useState(todayStr());
  const [vTime, setVTime] = useState(nowTime());
  const [vWork, setVWork] = useState('');
  const [vSup, setVSup] = useState(() => ((c.visits || []).slice(-1)[0] || {}).supervisor || '');

  const teeth = c.teeth || {};
  const visits = [...(c.visits || [])].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const set = (k, v) => { verRef.current += 1; setD((p) => ({ ...p, [k]: v })); setDirty(true); };

  useEffect(() => {
    if (!dirty || !d.name.trim()) return;
    const v = verRef.current;
    const t = setTimeout(async () => {
      setAuto('saving');
      try { await save(c.id, { ...d, name: d.name.trim() }); if (verRef.current === v) setDirty(false); setAuto('saved'); } catch (e) { setAuto('error'); }
    }, 1500);
    return () => clearTimeout(t);
  }, [d, dirty]);
  const subj = subjects.find((s) => s.id === c.subject);

  const saveSheet = async () => {
    if (!d.name.trim()) { flash('اكتب اسم المريض'); return; }
    try { await save(c.id, { ...d, name: d.name.trim() }); setDirty(false); flash('تم الحفظ ✓'); } catch (e) { flash('ما انحفظ، تأكد من الإنترنت'); }
  };
  const toggleDone = async () => {
    const marking = c.status !== 'done';
    try {
      await save(c.id, { status: marking ? 'done' : 'active', doneAt: marking ? todayStr() : null });
      if (marking) {
        const inf = doneInfo ? doneInfo(c.subject) : null;
        if (inf && inf.done < inf.required && inf.remaining === 1) celebrate('🏆 أكملت كل متطلبات المواد! مبروك دكتور');
        else if (inf && inf.done + 1 === inf.required) celebrate(`🎉 مبروك! أكملت متطلبات ${subj ? subj.name : 'المادة'}`);
        else flash('تم إنجاز الحالة ✓');
      }
    } catch (e) { flash('ما انحفظ'); }
  };
  const goBack = () => {
    if (dirty && d.name.trim()) { try { save(c.id, { ...d, name: d.name.trim() }).catch(() => {}); } catch (e) {} }
    onBack();
  };

  const pickTooth = (n) => {
    const t = teeth[n] || {};
    setPickSignal(0); setTooth(n); setCond(t.condition || 'caries'); setNotes(t.notes || '');
    setTv(t.vitality || ''); setTcurv(t.curvature || ''); setTobt(t.obturation || '');
    setTrest(t.restorations ? [...t.restorations] : []);
    if (t.canalList) setTcanals(t.canalList.map((x) => ({ ...x })));
    else { const cnt = Number(t.canals) || (t.wl ? 1 : 0); setTcanals(Array.from({ length: cnt }, (_, i) => ({ id: uid8(), name: '', wl: i === 0 ? (t.wl || '') : '' }))); }
  };
  const saveTooth = async () => {
    const rec = { condition: cond, notes: notes.trim() };
    if (cond === 'rct') {
      if (tv) rec.vitality = tv;
      if (tcurv) rec.curvature = tcurv;
      if (tobt.trim()) rec.obturation = tobt.trim();
      const cl = tcanals.filter((x) => x.name.trim() || x.wl).map((x) => ({ id: x.id, name: x.name.trim(), wl: x.wl }));
      if (cl.length) rec.canalList = cl;
    }
    if (cond === 'filled' && trest.length) rec.restorations = trest;
    try { await save(c.id, { teeth: { ...teeth, [tooth]: rec } }); setTooth(null); } catch (e) { flash('ما انحفظ'); }
  };
  const clearTooth = async () => {
    const next = { ...teeth }; delete next[tooth];
    try { await save(c.id, { teeth: next }); setTooth(null); } catch (e) { flash('ما انحفظ'); }
  };

  const addVisit = async () => {
    if (!vWork.trim()) { flash('اكتب شنو انعمل بالزيارة'); return; }
    const v = { id: uid8(), date: vDate, time: vTime, work: vWork.trim(), supervisor: vSup.trim() };
    try { await save(c.id, { visits: [...(c.visits || []), v] }); setVWork(''); flash('تمت إضافة الزيارة ✓'); } catch (e) { flash('ما انحفظ'); }
  };
  const delVisit = async (id) => {
    if (!(await askConfirm('حذف هذه الزيارة؟', 'حذف'))) return;
    try { await save(c.id, { visits: (c.visits || []).filter((v) => v.id !== id) }); } catch (e) { flash('ما انحذفت'); }
  };

  const recorded = Object.entries(teeth).filter(([, t]) => t.condition !== 'sound' || hasToothInfo(t));

  return (
    <div className="app stack">
      <div className="row between wrap">
        <button className="link" onClick={goBack}>→ رجوع</button>
        <div className="row">
          <button className="btn soft small" onClick={() => onNewSheet(c)}>+ ورقة جديدة لنفس المريض</button>
          <button className="btn danger small" onClick={async () => { if (await askConfirm('حذف هذه الحالة نهائياً مع صورها؟', 'حذف')) remove(c.id); }}>حذف</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div className="avatar">{(c.name || '?').charAt(0)}</div>
          <div className="grow">
            <h2>{c.name}</h2>
            <div className="small muted bold">{c.age ? c.age + ' سنة' : ''}{c.age && c.gender ? ' · ' : ''}{c.gender || ''}</div>
          </div>
          <span className={'chip ' + (c.status === 'done' ? 'done' : 'work')}>{c.status === 'done' ? 'منجزة' : 'قيد العمل'}</span>
        </div>
        <div className="row between wrap" style={{ marginTop: 12 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="chip">{subj ? subj.name : 'بدون مادة'}</span>
            {caseDetail(c) ? <span className="chip done">{caseDetail(c)}</span> : null}
          </div>
          <button className={'btn small ' + (c.status === 'done' ? 'ghost' : '')} onClick={toggleDone}>{c.status === 'done' ? 'إعادة فتح الحالة' : 'تم إنجاز الحالة ✓'}</button>
        </div>
      </div>

      {c.phone ? (
        <div className="card row between" style={{ padding: '12px 16px' }}>
          <div><div className="hint">رقم الهاتف</div><div className="bold ltr">{c.phone}</div></div>
          <div className="row">
            <a className="btn soft small" href={'tel:' + telNumber(c.phone)}>📞 اتصال</a>
            <a className="btn small" style={{ background: '#25d366', boxShadow: 'none' }} href={'https://wa.me/' + waNumber(c.phone)} target="_blank" rel="noreferrer">واتساب</a>
          </div>
        </div>
      ) : null}

      <div className="tabs">
        <button className={tab === 'sheet' ? 'on' : ''} onClick={() => setTab('sheet')}>الورقة</button>
        <button className={tab === 'teeth' ? 'on' : ''} onClick={() => setTab('teeth')}>الأسنان</button>
        <button className={tab === 'visits' ? 'on' : ''} onClick={() => setTab('visits')}>الزيارات ({visits.length})</button>
        <button className={tab === 'photos' ? 'on' : ''} onClick={() => setTab('photos')}>الصور</button>
      </div>

      {tab === 'sheet' && (
        <div className="stack">
          <div className="card stack">
            <h3>بيانات المريض</h3>
            <label className="field"><span>الاسم</span><input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} /></label>
            <div className="grid2">
              <label className="field"><span>العمر</span><input className="input" type="number" inputMode="numeric" value={d.age} onChange={(e) => set('age', e.target.value)} /></label>
              <label className="field"><span>الجنس</span>
                <select className="input" value={d.gender} onChange={(e) => set('gender', e.target.value)}><option value="">—</option><option>ذكر</option><option>أنثى</option></select>
              </label>
            </div>
            <div>
              <span className="fieldlbl">الهاتف</span>
              <div className="row">
                <input className="input ltr grow" inputMode="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} />
                {d.phone ? (<>
                  <a className="btn soft small" href={'tel:' + telNumber(d.phone)}>📞</a>
                  <a className="btn small" style={{ background: '#25d366', boxShadow: 'none' }} href={'https://wa.me/' + waNumber(d.phone)} target="_blank" rel="noreferrer">واتساب</a>
                </>) : null}
              </div>
            </div>
            <label className="field"><span>التاريخ</span><input className="input" type="date" value={d.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label className="field"><span>العنوان</span><input className="input" value={d.address} onChange={(e) => set('address', e.target.value)} /></label>
            <label className="field"><span>المادة</span>
              <select className="input" value={d.subject} onChange={(e) => set('subject', e.target.value)}>
                <option value="">— اختر —</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          {(d.subject === 'operative' || d.subject === 'perio') && (
            <div className="card stack"><SubjectFields subject={d.subject} v={d} set={set} /></div>
          )}
          <div className="card stack">
            <h3>الشكوى الرئيسية</h3>
            <textarea className="input" value={d.chief} onChange={(e) => set('chief', e.target.value)} placeholder="مثال: ألم بالسن العلوي الأيسر عند أكل الحلويات" />
          </div>
          <div className="card stack">
            <h3>تاريخ الشكوى الحالية</h3>
            <p className="hint">البداية، الطبيعة، المدة، العوامل المزيدة والمخففة</p>
            <textarea className="input" value={d.presentIllness} onChange={(e) => set('presentIllness', e.target.value)} />
          </div>
          <div className="card stack">
            <h3>التاريخ الطبي والسني</h3>
            <label className="field"><span>التاريخ الطبي</span><textarea className="input" value={d.medicalHistory} onChange={(e) => set('medicalHistory', e.target.value)} placeholder="أمراض، أدوية، حساسية" /></label>
            <label className="field"><span>التاريخ السني</span><textarea className="input" value={d.dentalHistory} onChange={(e) => set('dentalHistory', e.target.value)} /></label>
          </div>
          <div className="card stack">
            <h3>الفحص</h3>
            <p className="hint">الفحص خارج الفم وداخله (اللثة، الأنسجة الرخوة)</p>
            <textarea className="input" value={d.examination} onChange={(e) => set('examination', e.target.value)} />
          </div>
          <div className="card stack">
            <h3>التشخيص وخطة العلاج</h3>
            <textarea className="input" value={d.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />
          </div>
          <button className="btn block" onClick={saveSheet} disabled={!dirty}>{dirty ? 'حفظ الآن' : 'محفوظة ✓'}</button>
          <p className="hint" style={{ textAlign: 'center' }}>{auto === 'error' ? 'تعذر الحفظ التلقائي، اضغط حفظ الآن' : dirty ? 'يُحفظ تلقائياً بعد لحظات...' : 'كل تعديلاتك تُحفظ تلقائياً ✓'}</p>
        </div>
      )}

      {tab === 'teeth' && (
        <div className="card stack">
          <div className="tabs navy">
            <button className={dent === 'permanent' ? 'on' : ''} onClick={() => setDent('permanent')}>دائمية</button>
            <button className={dent === 'primary' ? 'on' : ''} onClick={() => setDent('primary')}>لبنية</button>
          </div>
          <Odontogram dent={dent} teeth={teeth} selected={tooth} onPick={pickTooth} />
          <div className="legend">
            {CONDITIONS.map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.label}</span>)}
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>اضغط على أي سن لتحديد حالته وكتابة تفاصيله.</p>
          {recorded.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 6 }}>الأسنان المسجّلة</h3>
              {recorded.sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, t]) => {
                const cd = CONDITIONS.find((x) => x.id === t.condition);
                return (
                  <button key={n} className="item" onClick={() => { setDent(Number(n) > 50 && Number(n) < 90 ? 'primary' : 'permanent'); pickTooth(n); }}>
                    <span className="avatar" style={{ background: (cd ? cd.color : '#94a3b8') + '33', color: 'var(--ink)' }}>{n}</span>
                    <span className="grow">
                      <b>{cd ? cd.label : ''}</b>
                      {t.notes ? <span className="muted small bold"> — {t.notes}</span> : null}
                      {toothExtra(t) ? <div className="small muted bold">{toothExtra(t)}</div> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'visits' && (
        <div className="stack">
          <div className="card stack">
            <h3>زيارة جديدة</h3>
            <div className="grid2">
              <label className="field"><span>التاريخ</span><input className="input" type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} /></label>
              <label className="field"><span>الوقت</span><input className="input" type="time" value={vTime} onChange={(e) => setVTime(e.target.value)} /></label>
            </div>
            <label className="field"><span>شنو انعمل</span><textarea className="input" value={vWork} onChange={(e) => setVWork(e.target.value)} placeholder="مثال: تحضير سن 46 وأخذ طبعة" /></label>
            <label className="field"><span>الدكتور المشرف</span><input className="input" value={vSup} onChange={(e) => setVSup(e.target.value)} /></label>
            <button className="btn block" onClick={addVisit}>إضافة الزيارة</button>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>سجل الزيارات</h3>
            {visits.length === 0 ? <div className="empty">ما موجودة زيارات بعد</div> : visits.map((v) => (
              <div key={v.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="small bold muted ltr" style={{ textAlign: 'right' }}>{v.date} {v.time}</div>
                  <div className="bold" style={{ margin: '2px 0' }}>{v.work}</div>
                  {v.supervisor ? <div className="small muted bold">المشرف: {v.supervisor}</div> : null}
                </div>
                <button className="btn danger small" onClick={() => delVisit(v.id)}>حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'photos' && <PhotosTab c={c} uid={c.studentId} flash={flash} />}

      {tooth && (
        <Sheet title={'السن ' + tooth} onClose={() => setTooth(null)}>
          <div className="stack">
            <div className="grid2">
              {CONDITIONS.map((x) => (
                <button key={x.id} className="btn ghost" style={cond === x.id ? { borderColor: x.color, background: x.color + '33' } : {}} onClick={() => { setCond(x.id); if (x.id === 'filled' && trest.length === 0) setPickSignal((n) => n + 1); }}>
                  <i style={{ width: 10, height: 10, borderRadius: 4, background: x.color, display: 'inline-block' }} /> {x.label}
                </button>
              ))}
            </div>
            {cond === 'filled' && (
              <div className="card stack" style={{ boxShadow: 'none', background: 'var(--brand-soft)' }}>
                <h3>Restoration Type</h3>
                <PopupPicker multi allowCustom options={FILLING_CLASSES} value={trest} onChange={setTrest} placeholder="اختر نوع الحشوة" title="Restoration Type" openSignal={pickSignal} />
              </div>
            )}
            <label className="field"><span>ملاحظة</span><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: composite class I" /></label>
            {cond === 'rct' && (
              <div className="card stack" style={{ boxShadow: 'none', background: 'var(--brand-soft)' }}>
                <h3>تفاصيل علاج العصب</h3>
                <label className="field"><span>اختبار الحيوية</span>
                  <select className="input" value={tv} onChange={(e) => setTv(e.target.value)}><option value="">—</option><option>حيوي</option><option>غير حيوي</option><option>غير مؤكد</option></select>
                </label>
                <div className="stack">
                  <div className="row between">
                    <h3>القنوات ({tcanals.length})</h3>
                    <button type="button" className="btn soft small" onClick={() => setTcanals([...tcanals, { id: uid8(), name: '', wl: '' }])}>＋ إضافة قناة</button>
                  </div>
                  <div className="chipsel">
                    {CANAL_SUGGEST.filter((n) => !tcanals.some((x) => x.name.trim().toUpperCase() === n)).map((n) => (
                      <button type="button" key={n} className="selchip" onClick={() => setTcanals([...tcanals, { id: uid8(), name: n, wl: '' }])}>＋ {n}</button>
                    ))}
                  </div>
                  {tcanals.length === 0 ? <p className="hint">اضغط "إضافة قناة" أو اختر اسم جاهز، وسجّل طول العمل لكل قناة.</p> : tcanals.map((cn) => (
                    <div key={cn.id} className="row">
                      <input className="input grow" placeholder="اسم القناة" value={cn.name} onChange={(e) => setTcanals(tcanals.map((x) => (x.id === cn.id ? { ...x, name: e.target.value } : x)))} />
                      <input className="input ltr" style={{ width: 92 }} type="number" inputMode="decimal" placeholder="WL مم" value={cn.wl} onChange={(e) => setTcanals(tcanals.map((x) => (x.id === cn.id ? { ...x, wl: e.target.value } : x)))} />
                      <button type="button" className="x" aria-label="حذف القناة" onClick={() => setTcanals(tcanals.filter((x) => x.id !== cn.id))}>✕</button>
                    </div>
                  ))}
                </div>
                <label className="field"><span>انحناء القناة</span>
                  <select className="input" value={tcurv} onChange={(e) => setTcurv(e.target.value)}><option value="">—</option><option>خفيف</option><option>متوسط</option><option>شديد</option></select>
                </label>
                <label className="field"><span>طريقة الحشو</span><input className="input" value={tobt} onChange={(e) => setTobt(e.target.value)} placeholder="مثال: Lateral Condensation" /></label>
              </div>
            )}
            <div className="row">
              <button className="btn ghost" onClick={clearTooth}>مسح</button>
              <button className="btn grow" onClick={saveTooth}>حفظ</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function LockedScreen({ expired }) {
  return (
    <div className="center">
      <div className="card stack" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={92} /></div>
        <h2>{expired ? 'انتهى اشتراكك ⏳' : 'حسابك قيد المراجعة ⏳'}</h2>
        <p className="muted bold">{expired ? 'انتهت مدة اشتراكك. يرجى مراسلة الدعم لتجديده.' : 'حسابك قيد المراجعة حالياً. يرجى مراسلة الدعم لتفعيله.'}</p>
        <a className="btn block" href={`https://wa.me/${SUPPORT_WA}`} target="_blank" rel="noreferrer">مراسلة الدعم عبر واتساب</a>
        <button className="btn ghost block" onClick={() => signOut(auth)}>تسجيل الخروج</button>
      </div>
    </div>
  );
}

const daysLeftOf = (end) => {
  if (!end) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(end + 'T00:00:00').getTime() - t.getTime()) / 86400000);
};

function SuperAdmin({ flash }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [st, ss] = await Promise.all([getDocs(collection(db, 'students')), getDocs(collection(db, 'student_status'))]);
      const map = {};
      ss.forEach((d) => { map[d.id] = d.data(); });
      setRows(st.docs.map((d) => ({ id: d.id, ...d.data(), status: map[d.id] || {} })));
    } catch (e) { flash('ما كدرت أحمّل القائمة'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const info = (r) => {
    const blocked = r.status.isApproved === false;
    const left = daysLeftOf(r.status.subscriptionEndDate);
    return { blocked, left };
  };

  const total = rows.length;
  const cnt = { blocked: 0, expired: 0, expiring: 0, active: 0 };
  rows.forEach((r) => {
    const { blocked, left } = info(r);
    if (blocked) cnt.blocked += 1;
    else if (left !== null && left < 0) cnt.expired += 1;
    else if (left !== null && left <= 5) cnt.expiring += 1;
    else cnt.active += 1;
  });

  const list = rows.filter((r) => !q.trim() || (r.name || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.email || '').toLowerCase().includes(q.trim().toLowerCase()));

  const openEdit = (r) => setEdit({ id: r.id, name: r.name || '', email: r.email || '', isApproved: r.status.isApproved !== false, plan: r.status.subscriptionType || PLANS[0], end: r.status.subscriptionEndDate || '' });
  const extend = (days) => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    if (edit.end) { const cur = new Date(edit.end + 'T00:00:00'); if (cur > base) base.setTime(cur.getTime()); }
    base.setDate(base.getDate() + days);
    setEdit({ ...edit, end: fmt(base) });
  };
  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'student_status', edit.id), {
        isApproved: edit.isApproved, subscriptionType: edit.plan, subscriptionEndDate: edit.end || '',
        expiresAt: edit.end ? Timestamp.fromDate(new Date(edit.end + 'T23:59:59')) : null, updatedAt: new Date().toISOString(),
      });
      setEdit(null); flash('تم الحفظ ✓'); load();
    } catch (e) { flash('ما انحفظ: ' + (e.code || '')); }
    setSaving(false);
  };

  return (
    <>
      <div className="row between"><h2>لوحة الإدارة العليا</h2><button className="btn soft small" onClick={load}>تحديث 🔄</button></div>
      <p className="hint">متابعة حسابات الطلاب وصلاحيات الدخول وأيام الاشتراك. هذه الصفحة لك أنت فقط.</p>

      <div className="subjgrid">
        <div className="card statcard"><div><div className="lbl">إجمالي الطلاب</div><div className="num">{total}</div></div></div>
        <div className="card statcard"><div><div className="lbl">فعّالة</div><div className="num" style={{ color: '#16a34a' }}>{cnt.active}</div></div></div>
        <div className="card statcard"><div><div className="lbl">تنتهي قريباً</div><div className="num" style={{ color: '#d97706' }}>{cnt.expiring}</div></div></div>
        <div className="card statcard"><div><div className="lbl">منتهية / موقوفة</div><div className="num" style={{ color: '#dc2626' }}>{cnt.expired + cnt.blocked}</div></div></div>
      </div>

      <input className="input" placeholder="ابحث باسم الطالب أو الإيميل..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card">
        {loading ? <div className="empty">جاري تحميل الطلاب...</div> : list.length === 0 ? <div className="empty">لا يوجد طلاب</div> : list.map((r) => {
          const { blocked, left } = info(r);
          let badge = <span className="chip">بدون تاريخ</span>;
          if (blocked) badge = <span className="chip" style={{ background: '#fee2e2', color: '#991b1b' }}>موقوف</span>;
          else if (left !== null && left < 0) badge = <span className="chip" style={{ background: '#fee2e2', color: '#991b1b' }}>منتهي ({Math.abs(left)} يوم)</span>;
          else if (left !== null && left <= 5) badge = <span className="chip work">ينتهي بعد {left} أيام</span>;
          else if (left !== null) badge = <span className="chip done">فعال ({left} يوم)</span>;
          return (
            <button key={r.id} className="item" onClick={() => openEdit(r)}>
              <div className="avatar">{(r.name || r.email || '?').charAt(0)}</div>
              <div className="grow">
                <div className="bold">{r.name || 'بدون اسم'}</div>
                <div className="small muted bold ltr" style={{ textAlign: 'right' }}>{r.email || '—'}</div>
                <div className="small muted bold">{r.status.subscriptionType || 'بدون باقة'}</div>
              </div>
              {badge}
            </button>
          );
        })}
      </div>

      {edit && (
        <Sheet title="إعدادات الطالب" onClose={() => setEdit(null)}>
          <div className="stack">
            <div className="card" style={{ boxShadow: 'none', background: 'var(--brand-soft)' }}>
              <div className="bold">{edit.name || 'بدون اسم'}</div>
              <div className="small muted bold ltr" style={{ textAlign: 'right' }}>{edit.email}</div>
            </div>
            <label className="row between card" style={{ boxShadow: 'none', cursor: 'pointer' }}>
              <span className="bold">تفعيل الحساب (السماح بالدخول)</span>
              <input type="checkbox" checked={edit.isApproved} onChange={(e) => setEdit({ ...edit, isApproved: e.target.checked })} style={{ width: 22, height: 22 }} />
            </label>
            <label className="field"><span>الباقة</span>
              <select className="input" value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
            <label className="field"><span>تاريخ انتهاء الاشتراك (اتركه فارغاً = بدون انتهاء)</span>
              <input className="input" type="date" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
            </label>
            <div className="grid3">
              <button className="btn soft small" onClick={() => extend(30)}>+ شهر</button>
              <button className="btn soft small" onClick={() => extend(90)}>+ 3 أشهر</button>
              <button className="btn soft small" onClick={() => extend(365)}>+ سنة</button>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={() => setEdit(null)}>إلغاء</button>
              <button className="btn grow" onClick={save} disabled={saving}>{saving ? '...' : 'حفظ التعديلات'}</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

/* ---------- التطبيق بعد تسجيل الدخول ---------- */
const BLANK_NC = { name: '', age: '', gender: '', phone: '', address: '', subject: '', fillingClasses: [], perioSeverity: '', calScore: '', chief: '', apptId: null, apptDate: null, apptTime: null };

function Main({ user }) {
  const [student, setStudent] = useState(null);
  const [cases, setCases] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [appointments, setAppointments] = useState([]); 
  const [view, setView] = useState('home');
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  
  // خاص بحجز يدوي جديد
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newApptData, setNewApptData] = useState({ name: '', phone: '', note: '', date: todayStr(), time: '' });

  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editSubj, setEditSubj] = useState(null);
  const [profName, setProfName] = useState('');
  const [profUni, setProfUni] = useState('');
  const [nc, setNc] = useState(BLANK_NC);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [status, setStatus] = useState({ loaded: false });
  const [pwWait, setPwWait] = useState(0);
  const [party, setParty] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [appLocked, setAppLocked] = useState(() => !!getLock(user.uid));
  const [lockOn, setLockOn] = useState(() => !!getLock(user.uid));
  const [lockOk, setLockOk] = useState(null);
  const lockedRef = useRef(null);

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 2400); };
  const celebrate = (m) => { setParty(m); setTimeout(() => setParty(null), 3800); };

  useEffect(() => { lockSupported().then(setLockOk); }, []);
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 30000 && getLock(user.uid)) setAppLocked(true);
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user.uid]);

  useEffect(() => {
    const onPop = (e) => setOpenId(e.state && e.state.open ? e.state.open : null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openCaseById = (id) => { try { window.history.pushState({ open: id }, ''); } catch (e) {} setOpenId(id); };
  const closeCase = () => { if (window.history.state && window.history.state.open) window.history.back(); else setOpenId(null); };

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'students', user.uid), (snap) => {
      if (snap.exists()) {
        const s = snap.data();
        setStudent(s); setProfName(s.name || ''); setProfUni(s.university || '');
      } else {
        const dflt = { subjects: DEFAULT_SUBJECTS, createdAt: Date.now() };
        setStudent(dflt);
        setDoc(doc(db, 'students', user.uid), dflt, { merge: true }).catch(() => {});
      }
    }, () => {});
    const unsub2 = onSnapshot(query(collection(db, 'cases'), where('studentId', '==', user.uid)), (snap) => {
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, () => {});
    const unsub3 = onSnapshot(query(collection(db, 'public_bookings'), where('studentId', '==', user.uid)), (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    }, () => {});
    const unsub4 = onSnapshot(query(collection(db, 'appointments'), where('studentId', '==', user.uid)), (snap) => {
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    }, () => {});
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user.uid]);

  // خوارزمية التنظيف الذكي لإزالة "الحجوزات الشبحية" وتأمين الأوقات (المزامنة الشاملة)
  useEffect(() => {
    if (!user || !user.uid) return;
    const t = setTimeout(async () => {
      try {
        const valid = new Map();
        appointments.forEach(a => { if(a.date && a.time) valid.set(slotId(user.uid, a.date, a.time), { date: a.date, time: a.time }); });
        bookings.forEach(b => { if(b.date && b.time) valid.set(slotId(user.uid, b.date, b.time), { date: b.date, time: b.time }); });
        cases.forEach(c => { if(c.status !== 'done' && c.apptDate && c.apptTime) valid.set(slotId(user.uid, c.apptDate, c.apptTime), { date: c.apptDate, time: c.apptTime }); });
        
        const snap = await getDocs(query(collection(db, 'public_slots'), where('studentId', '==', user.uid)));
        const b = writeBatch(db);
        let ops = 0;
        
        const existing = new Set();
        snap.docs.forEach(d => {
          if (!valid.has(d.id)) { b.delete(d.ref); ops++; }
          else { existing.add(d.id); }
        });
        
        valid.forEach((val, key) => {
          if (!existing.has(key)) {
            b.set(doc(db, 'public_slots', key), { studentId: user.uid, date: val.date, time: val.time });
            ops++;
          }
        });

        if (ops > 0) await b.commit();
      } catch(e) {}
    }, 3000);
    return () => clearTimeout(t);
  }, [appointments, bookings, cases, user.uid]);

  useEffect(() => {
    if (pwWait <= 0) return;
    const t = setTimeout(() => setPwWait((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [pwWait]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'student_status', user.uid), (snap) => {
      setStatus({ loaded: true, ...(snap.exists() ? snap.data() : {}) });
    }, () => setStatus((p) => ({ ...p, loaded: true })));
    return () => unsub();
  }, [user.uid]);

  const isSuper = (user.email || '').trim().toLowerCase() === SUPER_EMAIL;
  const expMs = status.expiresAt && status.expiresAt.toMillis ? status.expiresAt.toMillis() : null;
  const blocked = status.isApproved === false;
  const expired = expMs !== null && expMs <= Date.now();
  const locked = !isSuper && (blocked || expired);
  const daysLeft = expMs !== null ? Math.ceil((expMs - Date.now()) / 86400000) : null;

  useEffect(() => {
    if (lockedRef.current === true && !locked) window.location.reload();
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (student && student.name && student.email !== user.email) saveStudent({ email: user.email }).catch(() => {});
    if (!student || !student.name) return;
    const t = setTimeout(() => {
      setDoc(doc(db, 'public_students', user.uid), { name: student.name, university: student.university || '', updatedAt: new Date().toISOString() }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [student && student.name, student && student.university, user.uid]);

  const subjects = useMemo(() => ((student && student.subjects) || DEFAULT_SUBJECTS).map((x) => (OLD_AR_NAMES[x.id] === x.name ? { ...x, name: (DEFAULT_SUBJECTS.find((d) => d.id === x.id) || x).name } : x)), [student]);
  const saveStudent = (patch) => setDoc(doc(db, 'students', user.uid), patch, { merge: true });

  const inventory = (student && student.inventory) || [];
  const lowItems = inventory.filter((i) => Number(i.qty) <= Number(i.min));
  const saveInventory = (next) => saveStudent({ inventory: next }).catch(() => flash('ما انحفظ، تأكد من الإنترنت'));
  const adjustItem = (id, d) => saveInventory(inventory.map((i) => (i.id === id ? { ...i, qty: Math.max(0, Number(i.qty) + d) } : i)));
  const openItem = (it) => setItemForm(it ? { id: it.id, name: it.name, qty: String(it.qty), min: String(it.min) } : { id: null, name: '', qty: '', min: '3' });
  const submitItem = () => {
    const f = itemForm; const name = f.name.trim();
    if (!name) { flash('اكتب اسم المادة'); return; }
    const qty = Number(f.qty);
    if (f.qty === '' || !Number.isFinite(qty) || qty < 0) { flash('اكتب الكمية'); return; }
    const min = f.min === '' ? 3 : Math.max(0, Number(f.min) || 0);
    saveInventory(f.id ? inventory.map((i) => (i.id === f.id ? { ...i, name, qty, min } : i)) : [...inventory, { id: uid8(), name, qty, min }]);
    setItemForm(null);
  };
  const deleteItem = async (it) => { if (await askConfirm(`حذف "${it.name}" من المخزن؟`, 'حذف')) saveInventory(inventory.filter((i) => i.id !== it.id)); };
  
  const saveCase = (id, patch) => updateDoc(doc(db, 'cases', id), patch);
  const removeCase = async (id) => {
    const c = cases.find((x) => x.id === id);
    try {
      try {
        const ps = await getDocs(query(collection(db, 'case_photos'), where('studentId', '==', user.uid), where('caseId', '==', id)));
        for (let i = 0; i < ps.docs.length; i += 200) {
          const b = writeBatch(db);
          ps.docs.slice(i, i + 200).forEach((d) => { b.delete(d.ref); b.delete(doc(db, 'case_photos_full', d.id)); });
          await b.commit();
        }
      } catch (err) {}
      await deleteDoc(doc(db, 'cases', id));
      closeCase();
    } catch (e) { flash('ما انحذفت'); }
  };

  const stats = useMemo(() => {
    const per = subjects.map((s) => ({ ...s, done: Math.min(cases.filter((c) => c.subject === s.id && c.status === 'done').length, s.required) }));
    const totalReq = per.reduce((a, s) => a + s.required, 0);
    const totalDone = per.reduce((a, s) => a + s.done, 0);
    return { per, totalReq, totalDone, pct: totalReq ? Math.round((totalDone / totalReq) * 100) : 0 };
  }, [subjects, cases]);

  const createCase = async () => {
    if (!nc.name.trim()) { flash('اكتب اسم المريض'); return; }
    if (!nc.subject) { flash('اختر المادة'); return; }
    setBusy(true);
    try {
      const id = doc(collection(db, 'cases')).id;
      const batch = writeBatch(db);
      
      batch.set(doc(db, 'cases', id), {
        studentId: user.uid, name: nc.name.trim(), age: nc.age, gender: nc.gender, phone: nc.phone, address: nc.address, subject: nc.subject,
        chief: nc.chief || '',
        fillingClasses: nc.fillingClasses || [], perioSeverity: nc.perioSeverity || '', calScore: nc.calScore || '',
        status: 'active', date: todayStr(), apptDate: nc.apptDate || todayStr(), apptTime: nc.apptTime || '', createdAt: Date.now(), teeth: {}, visits: [],
      });
      
      if (nc.apptId) {
        batch.delete(doc(db, 'appointments', nc.apptId));
      }
      await batch.commit();

      setNewOpen(false); setNc(BLANK_NC); openCaseById(id);
    } catch (e) { flash('ما انحفظت الحالة، تأكد من الإنترنت'); }
    setBusy(false);
  };
  
  const openNewSheet = (c, appt = null) => { 
    setNc({ 
      ...BLANK_NC, 
      name: c ? c.name || '' : (appt ? appt.name : ''), 
      phone: c ? c.phone || '' : (appt ? appt.phone : ''), 
      chief: appt ? appt.chief : '',
      apptId: appt ? appt.id : null,
      apptDate: appt ? appt.date : null,
      apptTime: appt ? appt.time : null
    }); 
    setNewOpen(true); 
  };

  const newCaseSheet = newOpen ? (
    <Sheet title="حالة جديدة" onClose={() => setNewOpen(false)}>
      <div className="stack">
        <label className="field"><span>اسم المريض</span><input className="input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></label>
        <div className="grid2">
          <label className="field"><span>العمر</span><input className="input" type="number" inputMode="numeric" value={nc.age} onChange={(e) => setNc({ ...nc, age: e.target.value })} /></label>
          <label className="field"><span>الجنس</span>
            <select className="input" value={nc.gender} onChange={(e) => setNc({ ...nc, gender: e.target.value })}><option value="">—</option><option>ذكر</option><option>أنثى</option></select>
          </label>
        </div>
        <label className="field"><span>رقم الهاتف</span><input className="input ltr" inputMode="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></label>
        
        <label className="field"><span>الشكوى الرئيسية (اختياري)</span><textarea className="input" value={nc.chief} onChange={(e) => setNc({ ...nc, chief: e.target.value })} placeholder="مثال: ألم بالسن" /></label>

        <label className="field"><span>المادة</span>
          <select className="input" value={nc.subject} onChange={(e) => setNc({ ...nc, subject: e.target.value })}>
            <option value="">— اختر —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <SubjectFields subject={nc.subject} v={nc} set={(k, val) => setNc({ ...nc, [k]: val })} />
        <button className="btn block" onClick={createCase} disabled={busy}>{busy ? '...' : 'إنشاء وفتح الورقة'}</button>
      </div>
    </Sheet>
  ) : null;

  if (appLocked) return <AppLockScreen uid={user.uid} onUnlock={() => setAppLocked(false)} />;
  if (!status.loaded) return <Splash />;
  if (locked) return <LockedScreen expired={expired && !blocked} />;

  const doneInfo = (sid) => {
    const x = stats.per.find((y) => y.id === sid);
    return x ? { done: x.done, required: x.required, remaining: stats.totalReq - stats.totalDone } : null;
  };

  const openCase = cases.find((c) => c.id === openId);
  if (openCase) {
    return (
      <>
        <CaseDetail key={openCase.id} c={openCase} subjects={subjects} onBack={closeCase} save={saveCase} remove={removeCase} flash={flash} onNewSheet={openNewSheet} doneInfo={doneInfo} celebrate={celebrate} />
        {newCaseSheet}
        {party && <Confetti msg={party} />}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  const enableLock = async () => {
    try {
      const id = await lockEnroll(user.uid, user.email);
      localStorage.setItem(lockKey(user.uid), JSON.stringify({ id, at: Date.now() }));
      setLockOn(true); flash('تم تفعيل القفل ✓');
    } catch (e) { flash('تعذر تفعيل القفل (ألغيت العملية أو غير مدعوم)'); }
  };
  const disableLock = () => { try { localStorage.removeItem(lockKey(user.uid)); } catch (e) {} setLockOn(false); flash('تم إيقاف القفل'); };

  const sendPwMail = async () => {
    try { await sendPasswordResetEmail(auth, user.email); setPwWait(60); flash('تم إرسال رسالة التحقق ✓ تفقد الإيميل (وSpam)'); } catch (e) { flash(authError(e.code)); }
  };

  const bookLink = `${window.location.origin}/?book=${user.uid}`;
  
  const acceptBooking = async (b) => {
    try {
      const batch = writeBatch(db);
      const aid = doc(collection(db, 'appointments')).id;
      batch.set(doc(db, 'appointments', aid), {
        studentId: user.uid, name: b.name, phone: b.phone || '', chief: b.note || '',
        date: b.date, time: b.time, createdAt: Date.now(), source: 'online'
      });
      batch.delete(doc(db, 'public_bookings', b.id));
      await batch.commit();
      flash('تم قبول الحجز ونقله لقائمة الحجوزات المؤكدة ✓');
    } catch (e) { flash('ما انقبل، تأكد من الإنترنت'); }
  };

  const rejectBooking = async (b) => {
    if (!(await askConfirm('رفض هذا الطلب؟ سيرجع الوقت متاحاً للآخرين.', 'رفض'))) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'public_slots', slotId(user.uid, b.date, b.time)));
      batch.delete(doc(db, 'public_bookings', b.id));
      await batch.commit();
    } catch (e) { flash('ما انرفض'); }
  };

  const getAvailableManualTimes = () => {
    if (!newApptData.date) return [];
    const t1 = appointments.filter(a => a.date === newApptData.date).map(a => a.time);
    const t2 = bookings.filter(b => b.date === newApptData.date).map(b => b.time);
    const t3 = cases.filter(c => c.apptDate === newApptData.date && c.status !== 'done').map(c => c.apptTime);
    const all = [...t1, ...t2, ...t3].filter(Boolean);
    return STUDENT_TIMES.filter(t => !all.includes(t));
  };
  const manualTimes = getAvailableManualTimes();

  const saveManualBooking = async () => {
    if(!newApptData.name.trim() || !newApptData.date || !newApptData.time) { flash('أكمل الاسم والتاريخ والوقت'); return; }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const aid = doc(collection(db, 'appointments')).id;
      batch.set(doc(db, 'appointments', aid), {
        studentId: user.uid, name: newApptData.name.trim(), phone: normIraqPhone(newApptData.phone) || newApptData.phone, chief: newApptData.note.trim(),
        date: newApptData.date, time: newApptData.time, createdAt: Date.now(), source: 'manual'
      });
      batch.set(doc(db, 'public_slots', slotId(user.uid, newApptData.date, newApptData.time)), { studentId: user.uid, date: newApptData.date, time: newApptData.time });
      await batch.commit();
      setNewApptOpen(false); setNewApptData({ name: '', phone: '', note: '', date: todayStr(), time: '' }); flash('تم إضافة الحجز بنجاح ✓');
    } catch (e) { flash('حدث خطأ بالاتصال، حاول مجدداً'); }
    setBusy(false);
  };

  const deleteAppointment = async (a) => {
    if (!(await askConfirm('إلغاء هذا الحجز المؤكد وحذف الموعد؟', 'إلغاء الحجز'))) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'appointments', a.id));
      batch.delete(doc(db, 'public_slots', slotId(user.uid, a.date, a.time)));
      await batch.commit();
    } catch(e) { flash('حدث خطأ'); }
  };

  const copyLink = async () => { try { await navigator.clipboard.writeText(bookLink); saveStudent({ linkShared: true }).catch(() => {}); flash('تم نسخ الرابط ✓'); } catch (e) { flash('انسخ الرابط يدوياً'); } };

  const exportJson = () => {
    const payload = {
      app: 'sestemy-college', version: 1, exportedAt: new Date().toISOString(),
      student: { name: student?.name || '', university: student?.university || '', subjects, inventory },
      cases: cases.map(({ id, studentId, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sestemy-college-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importJson = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'sestemy-college' || !Array.isArray(data.cases)) { flash('الملف مو نسخة Sestemy College'); return; }
      if (!(await askConfirm(`استيراد ${data.cases.length} حالة؟ تنضاف للموجود ولا تحذف شي.`, 'استيراد'))) return;
      if (data.student && Array.isArray(data.student.subjects) && data.student.subjects.length) await saveStudent({ subjects: data.student.subjects });
      if (data.student && Array.isArray(data.student.inventory) && data.student.inventory.length && inventory.length === 0) await saveStudent({ inventory: data.student.inventory });
      for (let i = 0; i < data.cases.length; i += 400) {
        const batch = writeBatch(db);
        data.cases.slice(i, i + 400).forEach((c) => {
          batch.set(doc(collection(db, 'cases')), { ...c, studentId: user.uid, createdAt: c.createdAt || Date.now() });
        });
        await batch.commit();
      }
      flash('تم الاستيراد ✓');
    } catch (err) { flash('الملف غير صالح'); }
  };

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) { flash('المتصفح منع النافذة، اسمح بها وجرّب'); return; }
    const sNm = (id) => (subjects.find((s) => s.id === id) || {}).name || '—';
    const body = cases.map((c) => {
      const tl = Object.entries(c.teeth || {}).filter(([, t]) => t.condition !== 'sound' || hasToothInfo(t))
        .map(([n, t]) => `${esc(n)}: ${esc((CONDITIONS.find((x) => x.id === t.condition) || {}).label)}${t.notes ? ' (' + esc(t.notes) + ')' : ''}${toothExtra(t) ? ' [' + esc(toothExtra(t)) + ']' : ''}`).join(' | ');
      const vl = (c.visits || []).slice().sort((a, b) => a.date.localeCompare(b.date))
        .map((v) => `<li>${esc(v.date)} ${esc(v.time)} — ${esc(v.work)}${v.supervisor ? ' (المشرف: ' + esc(v.supervisor) + ')' : ''}</li>`).join('');
      return `<section><h2>${esc(c.name)} <small>${esc(c.age)} ${esc(c.gender)} · ${esc(sNm(c.subject))} · ${c.status === 'done' ? 'منجزة' : 'قيد العمل'}</small></h2>
        ${caseDetail(c) ? `<p><b>Details:</b> ${esc(caseDetail(c))}</p>` : ''}<p><b>الشكوى:</b> ${esc(c.chief)}</p><p><b>التاريخ الطبي:</b> ${esc(c.medicalHistory)}</p><p><b>الفحص:</b> ${esc(c.examination)}</p>
        <p><b>التشخيص والخطة:</b> ${esc(c.diagnosis)}</p>${tl ? `<p><b>الأسنان:</b> ${tl}</p>` : ''}${vl ? `<ul>${vl}</ul>` : ''}</section>`;
    }).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${esc(student?.name || '')}</title>
      <style>body{font-family:-apple-system,Tahoma,Arial,sans-serif;padding:24px;color:#16322d}h1{margin:0 0 4px}section{border-top:2px solid #2f8a6e;padding:10px 0;page-break-inside:avoid}h2{margin:0 0 6px;font-size:18px}small{font-weight:400;color:#475569;font-size:12px}p{margin:3px 0;font-size:13px}ul{margin:4px 0;font-size:12px}</style></head>
      <body><h1>sestemy COLLEGE — تقرير الحالات السريرية</h1><p>${esc(student?.name || '')} ${esc(student?.university || '')} — ${todayStr()} — ${cases.length} حالة</p>${body}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 500);
  };

  const saveSubject = async () => {
    const s = editSubj;
    if (!s.name.trim()) { flash('اكتب اسم المادة'); return; }
    const req = Math.max(1, parseInt(s.required, 10) || 1);
    const exists = subjects.some((x) => x.id === s.id);
    const next = exists ? subjects.map((x) => (x.id === s.id ? { id: s.id, name: s.name.trim(), required: req } : x)) : [...subjects, { id: s.id, name: s.name.trim(), required: req }];
    try { await saveStudent({ subjects: next }); setEditSubj(null); } catch (e) { flash('ما انحفظت'); }
  };
  const deleteSubject = async () => {
    if (!(await askConfirm('حذف هذه المادة؟ الحالات تبقى بس بدون مادة.', 'حذف'))) return;
    try { await saveStudent({ subjects: subjects.filter((x) => x.id !== editSubj.id) }); setEditSubj(null); } catch (e) { flash('ما انحذفت'); }
  };

  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? '☀️ صباح الخير' : hour < 18 ? '🌤️ نهارك سعيد' : '🌙 مساء الخير';
  const dateLine = `${toAr(now.getFullYear())}/${toAr(now.getMonth() + 1)}/${toAr(now.getDate())}`;
  const latest = cases[0];
  const closest = stats.per.filter((s) => s.done < s.required).sort((a, b) => (a.required - a.done) - (b.required - b.done)).slice(0, 3);
  const today = todayStr();
  const todayCount = cases.filter((c) => (c.apptDate === today && c.status !== 'done') || (c.visits || []).some((v) => v.date === today)).length;
  
  const upcoming = appointments.filter((a) => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);
  const remaining = stats.totalReq - stats.totalDone;
  const list = cases.filter((c) => (filter === 'all' || (filter === 'done' ? c.status === 'done' : c.status !== 'done')) && (!search.trim() || (c.name || '').includes(search.trim())));
  const sName = (id) => (subjects.find((s) => s.id === id) || {}).name || 'بدون مادة';
  const firstName = ((student && student.name) || '').split(' ')[0] || 'طالب';
  const guideSteps = [
    { t: 'أضف أول مريض', d: 'اضغط ＋ وأنشئ حالة جديدة', ok: cases.length > 0, go: () => openNewSheet(null) },
    { t: 'سجّل حالة سن بالخريطة', d: 'افتح حالة ← الأسنان ← اضغط على سن', ok: cases.some((c) => Object.keys(c.teeth || {}).length > 0), go: () => (cases[0] ? openCaseById(cases[0].id) : openNewSheet(null)) },
    { t: 'اكتب اسم جامعتك', d: 'من الإعدادات', ok: !!(student && (student.university || '').trim()), go: () => setView('settings') },
    { t: 'شارك رابط الحجز مع مرضاك', d: 'من تبويب الحجوزات', ok: !!(student && student.linkShared), go: () => setView('bookings') },
  ];
  const guideDone = guideSteps.filter((x) => x.ok).length;
  const showGuide = !!student && !student.hideGuide && guideDone < guideSteps.length;
  const isStandalone = typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);

  return (
    <div className="app stack">
      <div className="topbar">
        <Brand />
        <div className="row" style={{ gap: 6 }}>
          <span className={'pill' + (online ? '' : ' off')}><i />{online ? 'متصل سحابياً' : 'غير متصل'}</span>
          <span className="pill user">🎓 {firstName}</span>
        </div>
      </div>

      {view === 'home' && (
        <>
          <div className="hero">
            <div className="greet">{greet} دكتور، سجل سريري مرتب وعمل مكلل بالنجاح</div>
            <h1>{(student && student.name) || user.email}</h1>
            <div className="date">تاريخ اليوم: {dateLine}</div>
            <div className="meter">
              <div className="row between" style={{ marginBottom: 6, fontWeight: 800, fontSize: 13 }}><span>أنجزت {stats.totalDone} من {stats.totalReq} حالة مطلوبة</span><span>{stats.pct}%</span></div>
              <div className="bar"><i style={{ width: stats.pct + '%' }} /></div>
            </div>
            <button className="glass-btn" onClick={() => openNewSheet(null)}>＋ إضافة حالة جديدة</button>
          </div>

          {!isSuper && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && <div className="alert" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' }}>⏳ اشتراكك ينتهي بعد {daysLeft} أيام، تواصل مع الدعم للتجديد</div>}
          {lowItems.length > 0 && <button className="alert" style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }} onClick={() => setView('inventory')}>📦 {lowItems.length} مواد وصلت للحد الأدنى بالمخزن</button>}
          {bookings.length > 0 && <button className="alert" onClick={() => setView('bookings')}>📅 {bookings.length} طلب حجز جديد بانتظار ردك</button>}
          {remaining > 0 && <button className="alert" style={{ background: 'var(--brand-soft)', borderColor: 'var(--line)', color: 'var(--brand-dark)' }} onClick={() => setView('subjects')}>📚 باقي {remaining} حالة لإكمال المتطلبات</button>}

          {showGuide && (
            <div className="card stack">
              <div className="row between"><h3>🚀 ابدأ بـ Sestemy College</h3><button className="link" onClick={() => saveStudent({ hideGuide: true }).catch(() => {})}>إخفاء</button></div>
              <Progress max={guideSteps.length} value={guideDone} />
              <div>
                {guideSteps.map((st) => (
                  <button key={st.t} className="item" onClick={st.go} disabled={st.ok}>
                    <span className={'tick' + (st.ok ? ' ok' : '')}>{st.ok ? '✓' : ''}</span>
                    <div className="grow"><div className="bold" style={{ textDecoration: st.ok ? 'line-through' : 'none', opacity: st.ok ? 0.55 : 1 }}>{st.t}</div><div className="small muted bold">{st.d}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card statcard"><div><div className="lbl">حالات اليوم</div><div className="num" style={{ color: 'var(--brand-dark)' }}>{todayCount}</div></div><div className="ico g"><Icon name="users" /></div></div>
          <div className="card statcard"><div><div className="lbl">إجمالي المرضى</div><div className="num" style={{ color: 'var(--blue)' }}>{cases.length}</div></div><div className="ico b"><Icon name="pulse" /></div></div>
          <div className="card statcard"><div><div className="lbl">تنبيهات المخزن</div><div className="num" style={{ color: 'var(--amber)' }}>{lowItems.length} <span className="hint">مواد</span></div></div><div className="ico o"><Icon name="box" /></div></div>
          <div className="card statcard"><div><div className="lbl">طلبات الحجز</div><div className="num" style={{ color: 'var(--red)' }}>{bookings.length}</div></div><div className="ico r"><Icon name="calendar" /></div></div>

          {upcoming.length > 0 && (
            <div className="card">
              <div className="row between"><h3>مواعيدي القادمة</h3><button className="link" onClick={() => setView('bookings')}>الكل</button></div>
              {upcoming.map((a) => (
                <button key={a.id} className="item" onClick={() => setView('bookings')}>
                  <div className="avatar">{(a.name || '?').charAt(0)}</div>
                  <div className="grow"><div className="bold">{a.name}</div><div className="small muted bold ltr" style={{ textAlign: 'right' }}>{a.date} · {a.time}</div></div>
                  <span className="chip work">حجز</span>
                </button>
              ))}
            </div>
          )}

          <div className="card">
            <div className="row between"><h3>آخر مريض</h3><button className="link" onClick={() => setView('cases')}>الكل</button></div>
            {latest ? (
              <button className="item" onClick={() => openCaseById(latest.id)}>
                <div className="avatar">{(latest.name || '?').charAt(0)}</div>
                <div className="grow"><div className="bold">{latest.name}</div><div className="small muted bold">{sName(latest.subject)}</div></div>
                <span className="chip">فتح</span>
              </button>
            ) : <div className="empty">ما أضفت أي حالة بعد</div>}
          </div>

          <div className="card">
            <div className="row between" style={{ marginBottom: 8 }}><h3>الأقرب للإكمال</h3><button className="link" onClick={() => setView('subjects')}>الكل</button></div>
            {closest.length === 0 ? <div className="empty">أكملت كل المتطلبات 🎉</div> : closest.map((s) => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div className="row between small bold" style={{ marginBottom: 4 }}><span>{s.name}</span><span className="muted">{s.done} من {s.required}</span></div>
                <Progress max={s.required} value={s.done} />
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 6 }}>الزيارات خلال 8 أسابيع</h3>
            <WeekChart data={weeklyCounts(cases)} />
          </div>
        </>
      )}

      {view === 'cases' && (
        <>
          <div className="row between"><h2>المرضى</h2><button className="btn small" onClick={() => openNewSheet(null)}>+ حالة جديدة</button></div>
          <input className="input" placeholder="ابحث باسم المريض..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="tabs">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>الكل</button>
            <button className={filter === 'active' ? 'on' : ''} onClick={() => setFilter('active')}>قيد العمل</button>
            <button className={filter === 'done' ? 'on' : ''} onClick={() => setFilter('done')}>منجزة</button>
          </div>
          <div className="card">
            {list.length === 0 ? <div className="empty">{cases.length === 0 ? <>ما أضفت أي حالة بعد<br /><button className="btn small" style={{ marginTop: 12 }} onClick={() => openNewSheet(null)}>＋ أضف أول حالة</button></> : 'ما موجودة حالات بهذا الفلتر'}</div> : list.map((c) => (
              <button key={c.id} className="item" onClick={() => openCaseById(c.id)}>
                <div className="avatar">{(c.name || '?').charAt(0)}</div>
                <div className="grow"><div className="bold">{c.name}</div><div className="small muted bold">{sName(c.subject)}{caseDetail(c) ? ' · ' + caseDetail(c) : ''}{c.age ? ' · ' + c.age + ' سنة' : ''}</div></div>
                <span className={'chip ' + (c.status === 'done' ? 'done' : 'work')}>{c.status === 'done' ? 'منجزة' : 'قيد العمل'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {view === 'bookings' && (
        <>
          <div className="row between">
            <h2>الحجوزات</h2>
            <button className="btn small" onClick={() => setNewApptOpen(true)}>+ حجز يدوي</button>
          </div>

          <div className="card stack">
            <h3>قائمة الحجوزات المؤكدة والقادمة ({appointments.length})</h3>
            <p className="hint">عند حضور المراجع، اضغط <b>(استلام)</b> لفتح ورقة رسمية (طبلة) له.</p>
            {appointments.length === 0 ? <div className="empty">لا توجد حجوزات مؤكدة حالياً</div> : appointments.map((a) => (
              <div key={a.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="bold">{a.name}</div>
                  <div className="small muted bold ltr" style={{ textAlign: 'right' }}>{a.phone}</div>
                  {a.chief && <div className="small muted bold">الشكوى: {a.chief}</div>}
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 6, minWidth: 100 }}>
                  <span className="chip work ltr" style={{ width: '100%', textAlign: 'center' }}>{a.date} · {a.time}</span>
                  <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <button className="btn danger small" style={{ flex: 1, padding: '4px 0' }} onClick={() => deleteAppointment(a)}>إلغاء</button>
                    <button className="btn small" style={{ flex: 2, padding: '4px 0' }} onClick={() => openNewSheet(null, a)}>استلام</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card stack">
            <div className="row between">
              <h3>طلبات الحجز الإلكتروني</h3>
              {bookings.length > 0 && <span className="badge">{bookings.length} جديد</span>}
            </div>
            {bookings.length === 0 ? <div className="empty" style={{ padding: '10px 0' }}>ما موجودة طلبات حجز حالياً</div> : bookings.map((b) => (
              <div key={b.id} className="card stack" style={{ background: 'var(--brand-soft)', boxShadow: 'none' }}>
                <div className="row between">
                  <div><div className="bold" style={{ fontSize: 17 }}>{b.name}</div><div className="small muted bold ltr" style={{ textAlign: 'right' }}>{b.phone}</div></div>
                  <span className="chip work ltr">{b.date} · {b.time}</span>
                </div>
                {b.note ? <p className="muted bold small">المشكلة: {b.note}</p> : null}
                <div className="row">
                  <button className="btn danger grow" onClick={() => rejectBooking(b)}>رفض</button>
                  <a className="btn soft" href={'tel:' + telNumber(b.phone)}>📞</a>
                  <a className="btn soft" href={'https://wa.me/' + waNumber(b.phone)} target="_blank" rel="noreferrer">واتس</a>
                  <button className="btn grow" onClick={() => acceptBooking(b)}>قبول ونقل للحجوزات</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card stack">
            <h3>رابط الحجز الخاص بك</h3>
            <p className="hint">أرسل هذا الرابط للمرضى ليتمكنوا من الحجز المباشر (من السبت للخميس).</p>
            <div className="input ltr small" style={{ wordBreak: 'break-all' }}>{bookLink}</div>
            <div className="grid2">
              <button className="btn soft" onClick={copyLink}>نسخ الرابط</button>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent('احجز موعد علاج عندي من هذا الرابط: ' + bookLink)}`} target="_blank" rel="noreferrer">مشاركة واتساب</a>
            </div>
          </div>
        </>
      )}

      {newApptOpen && (
        <Sheet title="إضافة حجز يدوي" onClose={() => setNewApptOpen(false)}>
          <div className="stack">
            <label className="field"><span>اسم المراجع</span><input className="input" value={newApptData.name} onChange={(e) => setNewApptData({...newApptData, name: e.target.value})} placeholder="الاسم الكامل" /></label>
            <label className="field"><span>رقم الهاتف</span><input className="input ltr" inputMode="tel" value={newApptData.phone} onChange={(e) => setNewApptData({...newApptData, phone: e.target.value})} placeholder="0770..." /></label>
            <label className="field"><span>الشكوى أو السبب (اختياري)</span><textarea className="input" value={newApptData.note} onChange={(e) => setNewApptData({...newApptData, note: e.target.value})} placeholder="مثال: حشوة تجميلية للسن الأمامي" /></label>
            <div className="grid2">
              <label className="field"><span>التاريخ</span><input className="input" type="date" value={newApptData.date} onChange={(e) => setNewApptData({...newApptData, date: e.target.value})} /></label>
              <label className="field"><span>الوقت</span>
                <select className="input" value={newApptData.time} onChange={(e) => setNewApptData({...newApptData, time: e.target.value})}>
                  <option value="">{newApptData.date ? (manualTimes.length > 0 ? 'اختر الوقت...' : 'جميع الأوقات محجوزة بهذا اليوم') : 'حدد التاريخ أولاً'}</option>
                  {manualTimes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <button className="btn block" onClick={saveManualBooking} disabled={busy || !newApptData.time}>{busy ? '...' : 'حفظ الحجز'}</button>
          </div>
        </Sheet>
      )}

      {view === 'subjects' && (
        <>
          <div className="row between"><h2>متطلبات المواد</h2><button className="btn small" onClick={() => setEditSubj({ id: 's' + uid8(), name: '', required: 5 })}>+ مادة</button></div>
          <p className="hint">الحالة تُحسب للمادة لما تضغط "تم إنجاز الحالة". تكدر تعدّل العدد المطلوب حسب كليتك.</p>
          {stats.per.length === 0 ? <div className="card empty">أضف مادة</div> : (
            <div className="subjgrid">
              {stats.per.map((s) => (
                <button key={s.id} className="card subj" onClick={() => setEditSubj({ ...s })}>
                  <Ring max={s.required} value={s.done} />
                  <b>{s.name}</b>
                  <span className="hint">{s.done} من {s.required}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'admin' && isSuper && <SuperAdmin flash={flash} />}

      {view === 'inventory' && (
        <>
          <div className="row between"><h2>مخزن المستلزمات</h2><button className="btn small" onClick={() => openItem(null)}>＋ مستلزم</button></div>
          <p className="hint">سجّل موادك (بنج، مواد حشوات، قفازات...) وتابع الكميات. يطلع تنبيه لما توصل المادة للحد الأدنى.</p>
          {lowItems.length > 0 && <div className="alert" style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>📦 {lowItems.length} مواد وصلت للحد الأدنى</div>}
          {inventory.length === 0 ? (
            <div className="card empty">المخزن فارغ حالياً. أضف مستلزماتك للبدء بالمراقبة.<br /><button className="btn small" style={{ marginTop: 12 }} onClick={() => openItem(null)}>＋ أضف أول مستلزم</button></div>
          ) : (
            <div className="invgrid">
              {inventory.map((item) => {
                const low = Number(item.qty) <= Number(item.min);
                return (
                  <div key={item.id} className={'card stack inv' + (low ? ' low' : '')}>
                    <div className="row between">
                      <h3 className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h3>
                      {low && <span className="chip lowchip">تنبيه!</span>}
                    </div>
                    <p className="hint">الحد الأدنى للتنبيه: <b>{item.min}</b></p>
                    <div className="qtybox"><span className="hint">الكمية الحالية</span><b className={'qty' + (low ? ' low' : '')}>{item.qty}</b></div>
                    <div className="row">
                      <button className="btn danger small grow" onClick={() => adjustItem(item.id, -1)}>− صرف</button>
                      <button className="btn soft small grow" onClick={() => adjustItem(item.id, 5)}>＋ توريد</button>
                      <button className="btn ghost small" aria-label="تعديل" onClick={() => openItem(item)}>✎</button>
                      <button className="btn ghost small" aria-label="حذف" onClick={() => deleteItem(item)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'settings' && (
        <>
          <h2>الإعدادات</h2>
          {isSuper && (
            <button className="card row between" style={{ width: '100%', textAlign: 'right' }} onClick={() => setView('admin')}>
              <div className="row"><div className="ico g" style={{ width: 44, height: 44, borderRadius: 16 }}><Icon name="shield" /></div><div><h3>لوحة الإدارة العليا</h3><p className="hint">الطلاب والاشتراكات</p></div></div>
              <span className="link">فتح</span>
            </button>
          )}
          <div className="card stack">
            <h3>ملفي</h3>
            <label className="field"><span>الاسم</span><input className="input" value={profName} onChange={(e) => setProfName(e.target.value)} /></label>
            <label className="field"><span>الجامعة / الكلية</span><input className="input" value={profUni} onChange={(e) => setProfUni(e.target.value)} /></label>
            <button className="btn block" onClick={async () => { try { await saveStudent({ name: profName.trim(), university: profUni.trim() }); flash('تم الحفظ ✓'); } catch (e) { flash('ما انحفظ'); } }}>حفظ</button>
          </div>
          {!isStandalone && (
            <div className="card stack">
              <h3>📲 ثبّت التطبيق على موبايلك</h3>
              <p className="hint">آيفون: افتح الرابط بـ Safari ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية". أندرويد: Chrome ← القائمة ⋮ ← "تثبيت التطبيق". بعدها يشتغل مثل أي تطبيق بأيقونته وبدون شريط المتصفح.</p>
            </div>
          )}
          <div className="card stack">
            <h3>🔒 قفل التطبيق</h3>
            <p className="hint">يُقفل التطبيق ويُفتح بـ Face ID أو البصمة أو رمز الجهاز. يُطلب عند فتح التطبيق، وبعد ما تتركه أكثر من 30 ثانية. القفل يخص هذا الجهاز فقط.</p>
            {lockOk === null ? null : lockOk ? (
              lockOn ? <button className="btn danger block" onClick={disableLock}>إيقاف القفل</button> : <button className="btn block" onClick={enableLock}>تفعيل القفل</button>
            ) : <p className="hint">هذا الجهاز أو المتصفح لا يدعم القفل. جرّب Safari على آيفون أو Chrome على أندرويد.</p>}
          </div>
          <div className="card stack">
            <h3>تغيير كلمة المرور</h3>
            <p className="hint">للأمان نرسل رسالة تحقق إلى إيميلك <span className="ltr bold">{user.email}</span>. افتح الرابط الذي بالرسالة واكتب كلمة المرور الجديدة.</p>
            <button className="btn block" onClick={sendPwMail} disabled={pwWait > 0}>{pwWait > 0 ? `أعد المحاولة بعد ${pwWait} ثانية` : 'إرسال رسالة التحقق'}</button>
          </div>
          <div className="card stack">
            <h3>اشتراكي</h3>
            <div className="row between"><span className="muted bold small">الباقة</span><span className="bold">{status.subscriptionType || 'بدون باقة'}</span></div>
            <div className="row between"><span className="muted bold small">ينتهي في</span><span className="bold ltr">{status.subscriptionEndDate || 'بدون انتهاء'}</span></div>
          </div>
          <div className="card stack">
            <h3>نسخ احتياطي</h3>
            <div className="grid2">
              <button className="btn soft" onClick={exportJson}>تصدير JSON</button>
              <label className="btn soft" style={{ cursor: 'pointer' }}>استيراد JSON<input type="file" accept="application/json,.json" onChange={importJson} style={{ display: 'none' }} /></label>
            </div>
            <button className="btn ghost block" onClick={printReport}>تقرير PDF (طباعة / حفظ كـ PDF)</button>
            <p className="hint">بياناتك محفوظة على حسابك ومحمية، ولا أحد غيرك يشوفها. حاول ما تكتب أسماء كاملة أو أرقام هواتف حقيقية للمرضى إذا كليتك تمنع ذلك.</p>
          </div>
          <div className="card stack">
            <div className="small muted bold ltr" style={{ textAlign: 'right' }}>{user.email}</div>
            <button className="btn danger block" onClick={() => signOut(auth)}>تسجيل الخروج</button>
          </div>
        </>
      )}

      <nav className="nav">
        <div className="nav-in">
          <button className={view === 'home' ? 'on' : ''} onClick={() => setView('home')} aria-label="الرئيسية"><Icon name="home" /></button>
          <button className={view === 'cases' ? 'on' : ''} onClick={() => setView('cases')} aria-label="المرضى"><Icon name="users" /></button>
          <button className="plus" onClick={() => openNewSheet(null)} aria-label="حالة جديدة"><Icon name="plus" /></button>
          <button className={'rel' + (view === 'bookings' ? ' on' : '')} onClick={() => setView('bookings')} aria-label="الحجوزات"><Icon name="calendar" />{bookings.length > 0 ? <em className="badge">{bookings.length}</em> : null}</button>
          <button className={view === 'subjects' ? 'on' : ''} onClick={() => setView('subjects')} aria-label="المواد"><Icon name="book" /></button>
          <button className={'rel' + (view === 'inventory' ? ' on' : '')} onClick={() => setView('inventory')} aria-label="المخزن"><Icon name="box" />{lowItems.length > 0 ? <em className="badge">{lowItems.length}</em> : null}</button>
          <button className={view === 'settings' ? 'on' : ''} onClick={() => setView('settings')} aria-label="الإعدادات"><Icon name="gear" /></button>
        </div>
      </nav>

      {itemForm && (
        <Sheet title={itemForm.id ? 'تعديل المستلزم' : 'مستلزم جديد'} onClose={() => setItemForm(null)}>
          <div className="stack">
            <label className="field"><span>اسم المادة</span><input className="input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="مثال: بنج أسنان (Lidocaine)" /></label>
            <div className="grid2">
              <label className="field"><span>{itemForm.id ? 'الكمية الحالية' : 'الكمية المدخلة الآن'}</span><input className="input" type="number" inputMode="numeric" min="0" value={itemForm.qty} onChange={(e) => setItemForm({ ...itemForm, qty: e.target.value })} placeholder="مثلاً: 50" /></label>
              <label className="field"><span>ينبهني عندما تصل إلى</span><input className="input" type="number" inputMode="numeric" min="0" value={itemForm.min} onChange={(e) => setItemForm({ ...itemForm, min: e.target.value })} placeholder="الافتراضي: 3" /></label>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={() => setItemForm(null)}>إلغاء</button>
              <button className="btn grow" onClick={submitItem}>{itemForm.id ? 'حفظ التعديل' : 'إضافة للمخزن'}</button>
            </div>
          </div>
        </Sheet>
      )}

      {newCaseSheet}

      {editSubj && (
        <Sheet title="المادة" onClose={() => setEditSubj(null)}>
          <div className="stack">
            <label className="field"><span>اسم المادة</span><input className="input" value={editSubj.name} onChange={(e) => setEditSubj({ ...editSubj, name: e.target.value })} /></label>
            <label className="field"><span>عدد الحالات المطلوبة</span><input className="input" type="number" inputMode="numeric" value={editSubj.required} onChange={(e) => setEditSubj({ ...editSubj, required: e.target.value })} /></label>
            <div className="row">
              {subjects.some((x) => x.id === editSubj.id) && <button className="btn danger" onClick={deleteSubject}>حذف</button>}
              <button className="btn grow" onClick={saveSubject}>حفظ</button>
            </div>
          </div>
        </Sheet>
      )}

      {party && <Confetti msg={party} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------- الجذر ---------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  const bookId = new URLSearchParams(window.location.search).get('book');
  let content;
  if (bookId) content = <PublicBooking id={bookId} />;
  else if (!ready) content = <Splash />;
  else if (!user) content = <AuthScreen />;
  else content = <Main user={user} />;
  return <ErrorBoundary><ConfirmHost />{content}</ErrorBoundary>;
}