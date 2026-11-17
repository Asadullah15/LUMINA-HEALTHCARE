/* =====================================================================
   Lumina Health \u2014 shared core: data model, demo data, roles & permissions.
   Used by server.js (real database in data.json) AND by the browser
   (demo mode, stored in localStorage) so the rules are identical.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LuminaCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  function HttpError(status, msg) { var e = new Error(msg); e.status = status; return e; }
  var fail = function (s, m) { throw HttpError(s, m); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var hm = function (d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  var dayOffset = function (n) { var d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  var today = function () { return ymd(new Date()); };
  var nowIso = function () { return new Date().toISOString(); };
  var str = function (v, max) { max = max || 200; return typeof v === "string" ? v.trim().slice(0, max) : (typeof v === "number" && isFinite(v) ? String(v) : ""); };
  var need = function (v, name, max) { var s = str(v, max); if (!s) fail(400, name + " is required"); return s; };
  var bool = function (v) { return v === true || v === "true" || v === "1"; };
  var num = function (v, min, max, name) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(v); if (!isFinite(n) || n < min || n > max) fail(400, "Please enter a valid " + name);
    return Math.round(n * 100) / 100;
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/, PHONE_RE = /^[6-9]\d{9}$/;
  var cleanPhone = function (v) { return str(v, 20).replace(/[\s\-()]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""); };
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  var ROLES = ["admin", "doctor", "nurse", "reception", "patient"];
  var STAFF = ["admin", "doctor", "nurse", "reception"];
  var APPT_STATUS = ["requested", "booked", "checked-in", "completed", "cancelled", "no-show"];

  function create(opts) {
    var hash = opts.hash, verify = opts.verify, rand = opts.rand;
    var newId = function (p) { return p + "_" + rand(5); };

    /* ---------------- demo data ---------------- */
    function seed() {
      var u = function (name, email, role, pw, extra) { return Object.assign({ id: newId("u"), name: name, email: email, role: role, password: hash(pw), active: true, phone: "", createdAt: nowIso() }, extra || {}); };
      var admin = u("Asha Menon", "admin@lumina.local", "admin", "Admin@123", { phone: "9000000001" });
      var meera = u("Dr. Meera Rao", "doctor@lumina.local", "doctor", "Doctor@123", { specialty: "Diabetologist & Endocrinologist", qualification: "MBBS, MD, DM (Endocrinology)", regNo: "TSMC 00000 (dummy)", phone: "9000000100" });
      var arvind = u("Dr. Arvind Shah", "arvind@lumina.local", "doctor", "Doctor@123", { specialty: "Paediatrician", qualification: "MBBS, DCH, DNB (Paediatrics)", regNo: "TSMC 00001 (dummy)", phone: "9000000101" });
      var farah = u("Dr. Farah Khan", "farah@lumina.local", "doctor", "Doctor@123", { specialty: "Obstetrician & Gynaecologist", qualification: "MBBS, MS (OBG)", regNo: "TSMC 00002 (dummy)", phone: "9000000102" });
      var nurse = u("Sr. Lakshmi Priya", "nurse@lumina.local", "nurse", "Nurse@123", { phone: "9000000200" });
      var rec = u("Kavya Reddy", "reception@lumina.local", "reception", "Reception@123", { phone: "9000000300" });

      var P = function (uhid, name, age, gender, phone, city, blood, allergies, extra) {
        return Object.assign({ id: "p_" + uhid, uhid: String(uhid), name: name, age: age, gender: gender, phone: phone, email: "", address: "[Address placeholder]", city: city, bloodGroup: blood, abha: "", emergencyContact: "", allergies: allergies, createdAt: nowIso() }, extra || {});
      };
      var patients = [
        P(25001, "Arjun Kumar", 42, "Male", "9876500001", "Hyderabad", "B+", "None known"),
        P(25002, "Priya Sharma", 31, "Female", "9876500002", "Secunderabad", "O+", "Penicillin"),
        P(25003, "Rahul Nair", 8, "Male", "9876500003", "Hyderabad", "A+", "None known", { emergencyContact: "Anil Nair (father) 9876500033" }),
        P(25004, "Sunita Reddy", 56, "Female", "9876500004", "Kukatpally", "B+", "Sulfa drugs"),
        P(25005, "Mohammed Irfan", 39, "Male", "9876500005", "Tolichowki", "O+", "None known"),
        P(25006, "Lakshmi Devi", 64, "Female", "9876500006", "Warangal", "AB+", "None known"),
        P(25007, "Vikram Patel", 47, "Male", "9876500007", "Madhapur", "A-", "Aspirin"),
        P(25008, "Ananya Iyer", 27, "Female", "9876500008", "Gachibowli", "O-", "None known"),
        P(25009, "Sai Teja", 22, "Male", "9876500009", "Hyderabad", "B-", "None known"),
        P(25010, "Fatima Begum", 51, "Female", "9876500010", "Mehdipatnam", "A+", "None known"),
        P(25011, "Ramesh Gupta", 60, "Male", "9876500011", "Ameerpet", "O+", "Iodine contrast"),
        P(25012, "Kavitha Rao", 35, "Female", "9876500012", "Kondapur", "B+", "None known"),
      ];
      var pat = u("Arjun Kumar", "patient@lumina.local", "patient", "Patient@123", { patientId: "p_25001", phone: "9876500001" });

      var appointments = [], vitals = [], prescriptions = [], invoices = [];
      var A = function (pid, doc, day, time, status, type, reason, vitalsDone) {
        var a = { id: newId("a"), patientId: pid, doctorId: doc.id, date: dayOffset(day), time: time, status: status, type: type || "In-clinic", reason: reason || "", vitalsDone: !!vitalsDone, createdAt: nowIso() };
        appointments.push(a); return a;
      };
      var V = function (a, v) {
        var rec = Object.assign({ id: newId("v"), patientId: a.patientId, appointmentId: a.id, date: a.date, time: a.time, bpSys: null, bpDia: null, pulse: null, temp: null, spo2: null, resp: null, height: null, weight: null, bmi: null, sugar: null, sugarType: "RBS", notes: "", recordedBy: nurse.id, createdAt: nowIso() }, v);
        if (rec.height && rec.weight) rec.bmi = Math.round(rec.weight / Math.pow(rec.height / 100, 2) * 100) / 100;
        vitals.push(rec); a.vitalsDone = true; return rec;
      };
      var counters = { uhid: 25012, invoice: 1000, rx: 3000 };
      var R = function (a, doc, data) {
        var v = vitals.filter(function (x) { return x.appointmentId === a.id; })[0] || null;
        var rx = Object.assign({ id: newId("rx"), number: "RX-" + (++counters.rx), patientId: a.patientId, doctorId: doc.id, appointmentId: a.id, date: a.date, time: a.time, vitals: v ? clone(v) : null, complaints: "", examination: "", diagnosis: "", diet: "", medicines: [], advice: "", tests: "", testsAfter: "", followUp: "", createdAt: nowIso() }, data);
        prescriptions.push(rx); return rx;
      };
      var I = function (pid, day, time, items, status, mode, discount) {
        var sub = items.reduce(function (s, i) { return s + i.amount; }, 0);
        var inv = { id: newId("inv"), number: "LH-" + (++counters.invoice), patientId: pid, date: dayOffset(day), time: time, items: items, discount: discount || 0, total: sub - (discount || 0), status: status, mode: status === "paid" ? mode : "", receivedBy: rec.id, createdAt: nowIso() };
        invoices.push(inv); return inv;
      };
      var M = function (name, composition, dosage, timing, frequency, duration, notes) { return { name: name, composition: composition, dosage: dosage, timing: timing, frequency: frequency, duration: duration, notes: notes || "" }; };

      // ---- past visits (completed) ----
      var a1 = A("p_25005", meera, -4, "21:00", "completed", "In-clinic", "Diabetes review");
      V(a1, { bpSys: 119, bpDia: 75, pulse: 87, height: 175.5, weight: 78.5, sugar: 212, sugarType: "RBS", spo2: 98, temp: 98.4 });
      R(a1, meera, {
        complaints: "T2DM, uncontrolled blood glucose, vitamin D deficiency\nIrregular follow-up\nInsomnia",
        examination: "No goitre\nNo pallor", diagnosis: "T2DM, uncontrolled BG, Vit D deficiency", diet: "1500 kcal diabetic diet\n45 min physical activity daily",
        medicines: [
          M("Tab. Glycomet GP 1 Forte", "Metformin 1000 mg + Glimepiride 1 mg", "1-0-1", "Before food", "Daily", "2 Months", "1 before breakfast, 1 before dinner"),
          M("Tab. Januvia 100", "Sitagliptin 100 mg", "1-0-0", "After food", "Daily", "2 Months", "After breakfast"),
          M("Tab. Rosuvas 10", "Rosuvastatin 10 mg", "0-0-1", "Bed time", "Daily", "2 Months", ""),
          M("Cap. Uprise D3 60K", "Cholecalciferol 60000 IU", "1-0-0", "Empty stomach", "Weekly", "8 Weeks", "Then once a month for 8 months, with milk"),
          M("Tab. Melatonin 3 mg", "Melatonin 3 mg", "0-0-1", "Bed time", "Daily", "1 Month", ""),
        ],
        advice: "Hypoglycaemia symptoms and precautions explained.\nBP monitoring advised once a week.\nMaintain a self-monitored blood glucose chart (4-point profile) once a week.",
        tests: "Fasting blood glucose, post-breakfast blood glucose, HbA1c", testsAfter: "2 Months", followUp: dayOffset(56),
      });
      I("p_25005", -4, "21:20", [{ description: "Consultation \u2014 Dr. Meera Rao", amount: 800 }, { description: "RBS (glucometer)", amount: 100 }], "paid", "UPI");

      var a2 = A("p_25004", meera, -7, "11:00", "completed", "In-clinic", "Sugar & BP review");
      V(a2, { bpSys: 142, bpDia: 90, pulse: 80, height: 158, weight: 69, sugar: 168, sugarType: "FBS", spo2: 97 });
      R(a2, meera, {
        complaints: "Known T2DM & HTN, on treatment\nOccasional giddiness", examination: "Pedal oedema absent", diagnosis: "Type 2 DM, Hypertension",
        diet: "Low salt, low sugar diet. Walk 30 min daily",
        medicines: [
          M("Tab. Amaryl 1", "Glimepiride 1 mg", "1-0-0", "Before food", "Daily", "1 Month"),
          M("Tab. Telma 40", "Telmisartan 40 mg", "1-0-0", "After food", "Daily", "1 Month"),
          M("Tab. Ecosprin 75", "Aspirin 75 mg", "0-1-0", "After food", "Daily", "1 Month"),
        ],
        advice: "Check BP at home twice a week. Avoid skipping meals.", tests: "HbA1c, lipid profile, serum creatinine", testsAfter: "1 Month", followUp: dayOffset(23),
      });
      I("p_25004", -7, "11:25", [{ description: "Consultation \u2014 Dr. Meera Rao", amount: 800 }, { description: "ECG", amount: 350 }], "paid", "Cash");

      var a3 = A("p_25003", arvind, -2, "17:30", "completed", "In-clinic", "Fever 2 days");
      V(a3, { temp: 101.2, pulse: 104, weight: 24, height: 126, spo2: 98, resp: 22 });
      R(a3, arvind, {
        complaints: "Fever x 2 days, mild cough, reduced appetite", examination: "Throat congested, chest clear", diagnosis: "Acute viral fever with URTI",
        diet: "Plenty of fluids, soft diet",
        medicines: [
          M("Syp. Calpol 250", "Paracetamol 250 mg/5 ml", "5ml-5ml-5ml", "After food", "SOS", "3 Days", "Only if temperature above 100\u00b0F"),
          M("Syp. Ascoril D Junior", "Dextromethorphan + Chlorpheniramine", "2.5ml-0-2.5ml", "After food", "Daily", "5 Days"),
        ],
        advice: "Tepid sponging for high fever. Return if fever persists beyond 3 days or breathing difficulty.", followUp: dayOffset(3),
      });
      I("p_25003", -2, "17:50", [{ description: "Consultation \u2014 Dr. Arvind Shah", amount: 600 }], "paid", "UPI");

      var a4 = A("p_25008", farah, -1, "12:00", "completed", "In-clinic", "Antenatal check-up");
      V(a4, { bpSys: 112, bpDia: 70, pulse: 84, weight: 61, height: 162, spo2: 99 });
      R(a4, farah, {
        complaints: "G1P0, 18 weeks gestation, routine visit", examination: "Fundal height corresponds to dates", diagnosis: "Normal pregnancy, 18 weeks",
        diet: "Balanced diet with extra protein, 8\u201310 glasses of water",
        medicines: [
          M("Tab. Folvite 5", "Folic acid 5 mg", "1-0-0", "After food", "Daily", "1 Month"),
          M("Tab. Shelcal 500", "Calcium 500 mg + Vitamin D3", "0-1-0", "After food", "Daily", "1 Month"),
          M("Tab. Orofer XT", "Ferrous ascorbate + Folic acid", "0-0-1", "After food", "Daily", "1 Month"),
        ],
        advice: "Anomaly scan due. Report any bleeding or reduced fetal movements immediately.", tests: "Anomaly scan (level II), CBC", testsAfter: "2 Weeks", followUp: dayOffset(27),
      });
      I("p_25008", -1, "12:20", [{ description: "Consultation \u2014 Dr. Farah Khan", amount: 900 }], "paid", "Card");

      var a5 = A("p_25006", meera, -5, "10:30", "completed", "Video", "Thyroid review");
      R(a5, meera, {
        complaints: "Hypothyroidism on treatment, fatigue", diagnosis: "Primary hypothyroidism",
        medicines: [M("Tab. Thyronorm 75", "Levothyroxine 75 mcg", "1-0-0", "Empty stomach", "Daily", "3 Months", "30 minutes before breakfast")],
        advice: "Take tablet at the same time daily.", tests: "TSH", testsAfter: "6 Weeks", followUp: dayOffset(40),
      });
      I("p_25006", -5, "10:50", [{ description: "Video consultation \u2014 Dr. Meera Rao", amount: 600 }], "paid", "UPI");
      I("p_25010", -3, "16:00", [{ description: "Consultation \u2014 Dr. Meera Rao", amount: 800 }, { description: "HbA1c", amount: 450 }], "paid", "UPI", 50);
      I("p_25011", -6, "18:10", [{ description: "Consultation \u2014 Dr. Meera Rao", amount: 800 }], "paid", "Cash");
      I("p_25012", -2, "19:00", [{ description: "Consultation \u2014 Dr. Farah Khan", amount: 900 }, { description: "Urine pregnancy test", amount: 150 }], "paid", "UPI");

      // ---- today ----
      var t1 = A("p_25001", meera, 0, "10:15", "checked-in", "In-clinic", "Follow-up \u2014 sugar review", false);
      V(t1, { bpSys: 134, bpDia: 86, pulse: 78, height: 172, weight: 84, sugar: 186, sugarType: "RBS", spo2: 98, temp: 98.2 });
      A("p_25002", meera, 0, "10:30", "checked-in", "In-clinic", "Fever and body ache", false);
      A("p_25007", meera, 0, "11:00", "booked", "In-clinic", "Thyroid & BP check");
      A("p_25009", meera, 0, "11:30", "booked", "Video", "Acne & weight gain");
      A("p_25003", arvind, 0, "17:00", "booked", "In-clinic", "Review after fever");
      A("p_25012", farah, 0, "12:30", "checked-in", "In-clinic", "Irregular periods", false);
      A("p_25010", meera, 0, "12:00", "requested", "In-clinic", "Diabetes follow-up");
      A("p_25011", meera, 0, "09:30", "no-show", "In-clinic", "Review");
      I("p_25001", 0, "10:05", [{ description: "Consultation \u2014 Dr. Meera Rao", amount: 800 }], "unpaid", "");
      // ---- upcoming ----
      A("p_25001", meera, 3, "09:30", "booked", "In-clinic", "Lab review");
      A("p_25004", meera, 5, "11:00", "booked", "In-clinic", "Monthly review");
      A("p_25008", farah, 7, "12:00", "booked", "In-clinic", "Anomaly scan review");

      return {
        settings: {
          clinicName: "Lumina Care Clinic", tagline: "Diabetes, Thyroid, Child & Women's Health",
          address: "[Street address placeholder], Banjara Hills, Hyderabad 500034", phone: "040-0000 0000 (dummy)",
          email: "care@luminahealth.in", timings: "Mon\u2013Sat, 10:00 AM \u2013 9:00 PM",
          rxNote: "Consultation fee valid for 1 week or 1 visit + 1 review, whichever is earlier. For emergencies, contact the nearest hospital.",
        },
        users: [admin, meera, arvind, farah, nurse, rec, pat],
        patients: patients, appointments: appointments, vitals: vitals, prescriptions: prescriptions, invoices: invoices,
        leads: [
          { id: newId("l"), type: "demo", name: "Dr. Sample Lead", email: "sample@clinic.in", phone: "9876500999", specialty: "Cardiology", city: "Hyderabad", organisation: "", topic: "", message: "", page: "index.html", status: "new", createdAt: nowIso() },
          { id: newId("l"), type: "contact", name: "City Care Hospital", email: "admin@citycare.example", phone: "9876500998", specialty: "", city: "", organisation: "Hospital", topic: "Pricing & plans", message: "We are a 60-bed hospital. Please share hospital plan pricing.", page: "contact.html", status: "contacted", createdAt: new Date(Date.now() - 86400e3).toISOString() },
        ],
        counters: counters,
      };
    }

    /* ---------------- lookups ---------------- */
    function pub(u) { var o = Object.assign({}, u); delete o.password; return o; }
    function names(db, x) {
      var p = db.patients.filter(function (q) { return q.id === x.patientId; })[0] || {};
      var o = Object.assign({}, x, { patientName: p.name || "Unknown patient", patientUhid: p.uhid || "", patientAge: p.age, patientGender: p.gender || "" });
      if (x.doctorId) { var d = db.users.filter(function (u) { return u.id === x.doctorId; })[0] || {}; o.doctorName = d.name || "Unknown"; o.doctorSpecialty = d.specialty || ""; o.doctorQualification = d.qualification || ""; o.doctorRegNo = d.regNo || ""; }
      if (x.recordedBy) o.recordedByName = (db.users.filter(function (u) { return u.id === x.recordedBy; })[0] || {}).name || "";
      if (x.receivedBy) o.receivedByName = (db.users.filter(function (u) { return u.id === x.receivedBy; })[0] || {}).name || "";
      return o;
    }
    var byDateDesc = function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); };
    var byDateAsc = function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); };
    var findOr404 = function (list, id, what) { return list.filter(function (x) { return x.id === id; })[0] || fail(404, what + " not found"); };
    var ownPatient = function (me, pid) { return me.role === "patient" && me.patientId === pid; };

    /* ---------------- routes ---------------- */
    var routes = [];
    function route(method, pattern, roles, fn) {
      var keys = [];
      var re = new RegExp("^" + pattern.replace(/:(\w+)/g, function (_, k) { keys.push(k); return "([^/]+)"; }) + "$");
      routes.push({ method: method, re: re, keys: keys, roles: roles, fn: fn });
    }

    // ---- account ----
    route("GET", "/api/me", "any", function (c) { return { user: pub(c.me) }; });
    route("POST", "/api/me/password", "any", function (c) {
      if (!verify(c.body.current || "", c.me.password)) fail(400, "Your current password is incorrect");
      if (typeof c.body.password !== "string" || c.body.password.length < 8) fail(400, "New password must be at least 8 characters");
      c.me.password = hash(c.body.password);
      return { ok: true };
    });
    route("GET", "/api/doctors", "any", function (c) {
      return c.db.users.filter(function (u) { return u.role === "doctor" && u.active; }).map(function (u) { return { id: u.id, name: u.name, specialty: u.specialty || "", qualification: u.qualification || "" }; });
    });
    route("GET", "/api/settings", "any", function (c) { return c.db.settings; });
    route("PUT", "/api/settings", ["admin"], function (c) {
      ["clinicName", "tagline", "address", "phone", "email", "timings", "rxNote"].forEach(function (k) { if (c.body[k] !== undefined) c.db.settings[k] = str(c.body[k], k === "rxNote" ? 400 : 160); });
      if (!c.db.settings.clinicName) fail(400, "Clinic name is required");
      return c.db.settings;
    });

    // ---- admin ----
    route("GET", "/api/stats", ["admin"], function (c) {
      var db = c.db, t = today(), revenue7 = [];
      for (var i = 6; i >= 0; i--) {
        var d = dayOffset(-i);
        revenue7.push({ date: d, amount: db.invoices.filter(function (x) { return x.date === d && x.status === "paid"; }).reduce(function (s, x) { return s + x.total; }, 0) });
      }
      var todayAppts = db.appointments.filter(function (a) { return a.date === t; });
      var byStatus = {}; todayAppts.forEach(function (a) { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
      var byRole = {}; db.users.forEach(function (u) { byRole[u.role] = (byRole[u.role] || 0) + 1; });
      return {
        users: db.users.length, usersByRole: byRole, patients: db.patients.length,
        todayAppointments: todayAppts.filter(function (a) { return a.status !== "cancelled"; }).length, todayByStatus: byStatus,
        revenuePaid: db.invoices.filter(function (x) { return x.status === "paid"; }).reduce(function (s, x) { return s + x.total; }, 0),
        revenueDue: db.invoices.filter(function (x) { return x.status !== "paid"; }).reduce(function (s, x) { return s + x.total; }, 0),
        prescriptions: db.prescriptions.length, newLeads: db.leads.filter(function (l) { return l.status === "new"; }).length, revenue7: revenue7,
      };
    });
    route("GET", "/api/users", ["admin"], function (c) { return c.db.users.map(pub); });
    function userFields(db, u, body, me, isNew) {
      if (isNew || body.name !== undefined) u.name = need(body.name, "Name", 80);
      if (isNew || body.email !== undefined) {
        var e = need(body.email, "Email", 120).toLowerCase();
        if (!EMAIL_RE.test(e)) fail(400, "Please enter a valid email");
        if (db.users.some(function (x) { return x.email === e && x.id !== u.id; })) fail(409, "A user with this email already exists");
        u.email = e;
      }
      if (isNew || body.role !== undefined) {
        if (ROLES.indexOf(body.role) < 0) fail(400, "Please choose a valid role");
        if (me && u.id === me.id && body.role !== "admin") fail(400, "You can't remove your own admin role");
        u.role = body.role;
      }
      if (body.active !== undefined && !isNew) {
        var active = bool(body.active);
        if (me && u.id === me.id && !active) fail(400, "You can't deactivate your own account");
        u.active = active;
      }
      if (body.phone !== undefined) { var ph = cleanPhone(body.phone); if (ph && !PHONE_RE.test(ph)) fail(400, "Please enter a valid 10-digit mobile number"); u.phone = ph; }
      ["specialty", "qualification", "regNo"].forEach(function (k) { if (body[k] !== undefined) u[k] = u.role === "doctor" ? str(body[k], 80) : ""; });
      if (isNew || body.password) {
        if (typeof body.password !== "string" || body.password.length < 8) fail(400, "Password must be at least 8 characters");
        u.password = hash(body.password);
      }
      if (u.role === "patient" && !u.patientId) {
        var p = newPatient(db, { name: u.name, phone: u.phone });
        u.patientId = p.id;
      }
    }
    route("POST", "/api/users", ["admin"], function (c) {
      var u = { id: newId("u"), active: true, createdAt: nowIso() };
      userFields(c.db, u, c.body, c.me, true);
      c.db.users.push(u);
      return pub(u);
    });
    route("PUT", "/api/users/:id", ["admin"], function (c) {
      var u = findOr404(c.db.users, c.params.id, "User");
      userFields(c.db, u, c.body, c.me, false);
      c.changedUser = u.id;
      return pub(u);
    });
    route("DELETE", "/api/users/:id", ["admin"], function (c) {
      if (c.params.id === c.me.id) fail(400, "You can't delete your own account");
      var i = c.db.users.findIndex(function (x) { return x.id === c.params.id; });
      if (i < 0) fail(404, "User not found");
      c.db.users.splice(i, 1); c.changedUser = c.params.id;
      return { ok: true };
    });

    // ---- patients (general data: reception only) ----
    function patientFields(p, body, isNew) {
      if (isNew || body.name !== undefined) p.name = need(body.name, "Patient name", 80);
      if (body.age !== undefined) p.age = num(body.age, 0, 130, "age");
      if (body.gender !== undefined) p.gender = ["Male", "Female", "Other"].indexOf(body.gender) >= 0 ? body.gender : "";
      if (body.phone !== undefined) { var ph = cleanPhone(body.phone); if (ph && !PHONE_RE.test(ph)) fail(400, "Please enter a valid 10-digit mobile number"); p.phone = ph; }
      if (body.email !== undefined) { var e = str(body.email, 120).toLowerCase(); if (e && !EMAIL_RE.test(e)) fail(400, "Please enter a valid email"); p.email = e; }
      if (body.bloodGroup !== undefined) p.bloodGroup = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].indexOf(body.bloodGroup) >= 0 ? body.bloodGroup : "";
      ["address"].forEach(function (k) { if (body[k] !== undefined) p[k] = str(body[k], 240); });
      ["city", "abha", "emergencyContact", "allergies"].forEach(function (k) { if (body[k] !== undefined) p[k] = str(body[k], 120); });
    }
    function newPatient(db, body) {
      db.counters = db.counters || { uhid: 25000, invoice: 1000, rx: 3000 };
      var p = { id: newId("p"), uhid: String(++db.counters.uhid), name: "", age: null, gender: "", phone: "", email: "", address: "", city: "", bloodGroup: "", abha: "", emergencyContact: "", allergies: "", createdAt: nowIso() };
      patientFields(p, body, true);
      db.patients.push(p);
      return p;
    }
    route("GET", "/api/patients", STAFF, function (c) { return c.db.patients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }); });
    route("POST", "/api/patients", ["reception"], function (c) { return newPatient(c.db, c.body); });
    route("PUT", "/api/patients/:id", ["reception"], function (c) { var p = findOr404(c.db.patients, c.params.id, "Patient"); patientFields(p, c.body, false); return p; });
    route("GET", "/api/patients/:id", "any", function (c) {
      var me = c.me, db = c.db;
      if (STAFF.indexOf(me.role) < 0 && !ownPatient(me, c.params.id)) fail(403, "You don't have access to this patient");
      var p = findOr404(db.patients, c.params.id, "Patient");
      var mine = function (x) { return x.patientId === p.id; };
      var nm = function (x) { return names(db, x); };
      var r = me.role;
      return Object.assign({}, p, {
        appointments: db.appointments.filter(mine).sort(byDateDesc).map(nm),
        vitals: ["admin", "doctor", "nurse", "patient"].indexOf(r) >= 0 ? db.vitals.filter(mine).sort(byDateDesc).map(nm) : [],
        prescriptions: ["admin", "doctor", "patient"].indexOf(r) >= 0 ? db.prescriptions.filter(mine).sort(byDateDesc).map(nm) : [],
        invoices: ["admin", "reception", "patient"].indexOf(r) >= 0 ? db.invoices.filter(mine).sort(byDateDesc).map(nm) : [],
      });
    });

    // ---- appointments ----
    route("GET", "/api/appointments", "any", function (c) {
      var me = c.me, list = c.db.appointments;
      if (me.role === "doctor") list = list.filter(function (a) { return a.doctorId === me.id; });
      if (me.role === "patient") list = list.filter(function (a) { return a.patientId === me.patientId; });
      if (c.query.date) list = list.filter(function (a) { return a.date === c.query.date; });
      return list.slice().sort(byDateAsc).map(function (a) { return names(c.db, a); });
    });
    route("POST", "/api/appointments", ["reception", "patient"], function (c) {
      var me = c.me, db = c.db;
      var patientId = me.role === "patient" ? me.patientId : need(c.body.patientId, "Patient");
      findOr404(db.patients, patientId, "Patient");
      var doctor = db.users.filter(function (u) { return u.id === c.body.doctorId && u.role === "doctor" && u.active; })[0] || fail(400, "Please choose a doctor");
      var date = need(c.body.date, "Date", 10), time = need(c.body.time, "Time", 5);
      if (!DATE_RE.test(date) || !TIME_RE.test(time)) fail(400, "Please enter a valid date and time");
      if (date < today()) fail(400, "Appointments can't be booked in the past");
      if (db.appointments.some(function (a) { return a.doctorId === doctor.id && a.date === date && a.time === time && ["cancelled", "no-show"].indexOf(a.status) < 0; }))
        fail(409, "That slot is already taken. Please pick another time.");
      var a = { id: newId("a"), patientId: patientId, doctorId: doctor.id, date: date, time: time, type: c.body.type === "Video" ? "Video" : "In-clinic", reason: str(c.body.reason, 200), status: me.role === "patient" ? "requested" : "booked", vitalsDone: false, createdAt: nowIso() };
      db.appointments.push(a);
      return names(db, a);
    });
    route("PUT", "/api/appointments/:id", ["reception", "doctor", "patient"], function (c) {
      var me = c.me, a = findOr404(c.db.appointments, c.params.id, "Appointment"), b = c.body;
      if (me.role === "patient") {
        if (a.patientId !== me.patientId) fail(403, "Not your appointment");
        if (b.status !== "cancelled" || ["requested", "booked"].indexOf(a.status) < 0) fail(400, "You can only cancel upcoming appointments");
        a.status = "cancelled";
      } else if (me.role === "doctor") {
        if (a.doctorId !== me.id) fail(403, "This appointment belongs to another doctor");
        if (["completed", "no-show"].indexOf(b.status) < 0) fail(403, "Doctors can only mark a visit as completed or no-show");
        a.status = b.status;
      } else {
        if (b.status !== undefined) { if (APPT_STATUS.indexOf(b.status) < 0) fail(400, "Invalid status"); a.status = b.status; }
        if (b.date !== undefined) { if (!DATE_RE.test(b.date)) fail(400, "Invalid date"); a.date = b.date; }
        if (b.time !== undefined) { if (!TIME_RE.test(b.time)) fail(400, "Invalid time"); a.time = b.time; }
      }
      a.updatedAt = nowIso();
      return names(c.db, a);
    });

    // ---- vitals (nurse records; doctor/admin view) ----
    function vitalsFields(v, b) {
      v.bpSys = num(b.bpSys, 50, 260, "systolic BP"); v.bpDia = num(b.bpDia, 30, 160, "diastolic BP");
      if ((v.bpSys == null) !== (v.bpDia == null)) fail(400, "Enter both systolic and diastolic BP");
      v.pulse = num(b.pulse, 20, 250, "pulse"); v.temp = num(b.temp, 90, 110, "temperature (\u00b0F)");
      v.spo2 = num(b.spo2, 50, 100, "SpO2"); v.resp = num(b.resp, 5, 80, "respiratory rate");
      v.height = num(b.height, 30, 250, "height (cm)"); v.weight = num(b.weight, 1, 350, "weight (kg)");
      v.bmi = v.height && v.weight ? Math.round(v.weight / Math.pow(v.height / 100, 2) * 100) / 100 : null;
      v.sugar = num(b.sugar, 20, 800, "blood sugar"); v.sugarType = ["RBS", "FBS", "PPBS"].indexOf(b.sugarType) >= 0 ? b.sugarType : "RBS";
      v.notes = str(b.notes, 500);
      if ([v.bpSys, v.pulse, v.temp, v.spo2, v.resp, v.height, v.weight, v.sugar].every(function (x) { return x == null; })) fail(400, "Enter at least one reading");
    }
    route("GET", "/api/vitals", ["admin", "doctor", "nurse", "patient"], function (c) {
      var list = c.db.vitals;
      if (c.me.role === "patient") list = list.filter(function (v) { return v.patientId === c.me.patientId; });
      if (c.query.patientId) list = list.filter(function (v) { return v.patientId === c.query.patientId; });
      if (c.query.date) list = list.filter(function (v) { return v.date === c.query.date; });
      return list.slice().sort(byDateDesc).map(function (v) { return names(c.db, v); });
    });
    route("POST", "/api/vitals", ["nurse"], function (c) {
      var db = c.db, b = c.body;
      var patientId = need(b.patientId, "Patient"); findOr404(db.patients, patientId, "Patient");
      var d = new Date();
      var v = { id: newId("v"), patientId: patientId, appointmentId: str(b.appointmentId, 40), date: ymd(d), time: hm(d), recordedBy: c.me.id, createdAt: nowIso() };
      vitalsFields(v, b);
      db.vitals.push(v);
      var a = v.appointmentId && db.appointments.filter(function (x) { return x.id === v.appointmentId; })[0];
      if (a) a.vitalsDone = true;
      return names(db, v);
    });
    route("PUT", "/api/vitals/:id", ["nurse"], function (c) {
      var v = findOr404(c.db.vitals, c.params.id, "Vitals record");
      vitalsFields(v, c.body); v.recordedBy = c.me.id; v.updatedAt = nowIso();
      return names(c.db, v);
    });

    // ---- prescriptions (doctor writes) ----
    route("GET", "/api/prescriptions", ["admin", "doctor", "patient"], function (c) {
      var me = c.me, list = c.db.prescriptions;
      if (me.role === "patient") list = list.filter(function (r) { return r.patientId === me.patientId; });
      else if (c.query.patientId) list = list.filter(function (r) { return r.patientId === c.query.patientId; });
      else if (me.role === "doctor") list = list.filter(function (r) { return r.doctorId === me.id; });
      return list.slice().sort(byDateDesc).map(function (r) { return names(c.db, r); });
    });
    route("POST", "/api/prescriptions", ["doctor"], function (c) {
      var db = c.db, b = c.body, me = c.me;
      var patientId = need(b.patientId, "Patient"); findOr404(db.patients, patientId, "Patient");
      var meds = (Array.isArray(b.medicines) ? b.medicines : []).map(function (m) {
        m = m || {};
        return { name: str(m.name, 100), composition: str(m.composition, 140), dosage: str(m.dosage, 40), timing: str(m.timing, 40), frequency: str(m.frequency, 40), duration: str(m.duration, 40), notes: str(m.notes, 200) };
      }).filter(function (m) { return m.name; }).slice(0, 25);
      if (!meds.length) fail(400, "Add at least one medicine");
      var followUp = str(b.followUp, 10); if (followUp && !DATE_RE.test(followUp)) fail(400, "Invalid follow-up date");
      var appointmentId = str(b.appointmentId, 40);
      var appt = appointmentId && db.appointments.filter(function (x) { return x.id === appointmentId; })[0];
      if (appt && appt.doctorId !== me.id) fail(403, "This appointment belongs to another doctor");
      var t = today();
      var v = db.vitals.filter(function (x) { return x.patientId === patientId && (appointmentId ? x.appointmentId === appointmentId : x.date === t); }).sort(byDateDesc)[0] || null;
      db.counters = db.counters || { uhid: 25000, invoice: 1000, rx: 3000 };
      var d = new Date();
      var rx = {
        id: newId("rx"), number: "RX-" + (++db.counters.rx), patientId: patientId, doctorId: me.id, appointmentId: appointmentId, date: ymd(d), time: hm(d), vitals: v ? clone(v) : null,
        complaints: str(b.complaints, 1000), examination: str(b.examination, 1000), diagnosis: str(b.diagnosis, 300), diet: str(b.diet, 500),
        medicines: meds, advice: str(b.advice, 1500), tests: str(b.tests, 400), testsAfter: str(b.testsAfter, 40), followUp: followUp, createdAt: nowIso(),
      };
      db.prescriptions.push(rx);
      if (appt) appt.status = "completed";
      return names(db, rx);
    });

    // ---- receipts (reception) ----
    route("GET", "/api/invoices", ["admin", "reception", "patient"], function (c) {
      var list = c.db.invoices;
      if (c.me.role === "patient") list = list.filter(function (i) { return i.patientId === c.me.patientId; });
      return list.slice().sort(byDateDesc).map(function (i) { return names(c.db, i); });
    });
    route("POST", "/api/invoices", ["reception"], function (c) {
      var db = c.db, b = c.body;
      var patientId = need(b.patientId, "Patient"); findOr404(db.patients, patientId, "Patient");
      var items = (Array.isArray(b.items) ? b.items : []).map(function (i) { i = i || {}; return { description: str(i.description, 100), amount: Math.round(Number(i.amount) * 100) / 100 }; })
        .filter(function (i) { return i.description && isFinite(i.amount) && i.amount > 0; }).slice(0, 30);
      if (!items.length) fail(400, "Add at least one item with an amount");
      var sub = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var discount = num(b.discount, 0, sub, "discount") || 0;
      db.counters = db.counters || { uhid: 25000, invoice: 1000, rx: 3000 };
      var d = new Date();
      var inv = { id: newId("inv"), number: "LH-" + (++db.counters.invoice), patientId: patientId, date: ymd(d), time: hm(d), items: items, discount: discount, total: sub - discount, status: b.status === "paid" ? "paid" : "unpaid", mode: b.status === "paid" ? str(b.mode, 20) : "", receivedBy: c.me.id, createdAt: nowIso() };
      db.invoices.push(inv);
      return names(db, inv);
    });
    route("PUT", "/api/invoices/:id", ["reception"], function (c) {
      var inv = findOr404(c.db.invoices, c.params.id, "Receipt");
      if (c.body.status !== undefined) inv.status = c.body.status === "paid" ? "paid" : "unpaid";
      if (c.body.mode !== undefined) inv.mode = str(c.body.mode, 20);
      inv.receivedBy = c.me.id;
      return names(c.db, inv);
    });

    // ---- website leads ----
    route("POST", "/api/leads", null, function (c) {
      var b = c.body;
      var email = need(b.email, "Email", 120).toLowerCase(); if (!EMAIL_RE.test(email)) fail(400, "Please enter a valid email");
      c.db.leads.push({ id: newId("l"), type: b.type === "contact" ? "contact" : "demo", name: need(b.name, "Name", 80), email: email, phone: cleanPhone(b.phone), specialty: str(b.specialty, 60), city: str(b.city, 60), organisation: str(b.organisation, 60), topic: str(b.topic, 60), message: str(b.message, 2000), page: str(b.page, 40), status: "new", createdAt: nowIso() });
      return { ok: true };
    });
    route("GET", "/api/leads", ["admin"], function (c) { return c.db.leads.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }); });
    route("PUT", "/api/leads/:id", ["admin"], function (c) {
      var l = findOr404(c.db.leads, c.params.id, "Lead");
      if (["new", "contacted", "converted", "closed"].indexOf(c.body.status) >= 0) l.status = c.body.status;
      return l;
    });
    route("DELETE", "/api/leads/:id", ["admin"], function (c) {
      var i = c.db.leads.findIndex(function (x) { return x.id === c.params.id; });
      if (i < 0) fail(404, "Lead not found");
      c.db.leads.splice(i, 1);
      return { ok: true };
    });

    /* ---------------- entry points ---------------- */
    function login(db, email, password) {
      var user = db.users.filter(function (u) { return u.email === str(email, 120).toLowerCase(); })[0];
      if (!user || !verify(password || "", user.password)) fail(401, "Incorrect email or password");
      if (!user.active) fail(403, "This account has been deactivated. Please contact your administrator.");
      user.lastLogin = nowIso();
      return user;
    }
    // Returns { data, changedUser } \u2014 throws errors with .status
    function handle(db, me, method, path, body, query) {
      var r = routes.filter(function (x) { return x.method === method && x.re.test(path); })[0];
      if (!r) fail(404, "Not found");
      if (r.roles) {
        if (!me) fail(401, "Please log in");
        if (r.roles !== "any" && r.roles.indexOf(me.role) < 0) fail(403, "Your role doesn't have permission to do this");
      }
      var m = path.match(r.re), params = {};
      r.keys.forEach(function (k, i) { params[k] = decodeURIComponent(m[i + 1]); });
      var ctx = { db: db, me: me, params: params, body: body || {}, query: query || {} };
      var data = r.fn(ctx);
      return { data: data, changedUser: ctx.changedUser };
    }
    return { seed: seed, login: login, handle: handle, pub: pub };
  }

  /* =================== Browser client (server or demo mode) =================== */
  function client() {
    if (typeof window === "undefined") throw new Error("client() is browser-only");
    var DB_KEY = "lumina-demo-db-v2", SESSION_KEY = "lumina-demo-session";
    var modeP = null, core = null;
    function cyrb(s) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0; i < s.length; i++) { var ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16); }
    function rand(n) { var a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
    function getCore() {
      if (!core) core = create({
        rand: rand,
        // Demo mode only: data lives in this browser, so this is a light hash, not real security.
        hash: function (pw) { var s = rand(8); return "demo:" + s + ":" + cyrb(s + pw); },
        verify: function (pw, stored) { var p = String(stored || "").split(":"); return p.length === 3 && cyrb(p[1] + pw) === p[2]; },
      });
      return core;
    }
    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
    var memDb = null, memSession = null; // fallback when storage is blocked
    function loadDb() { var raw = store(DB_KEY); if (raw) { try { return JSON.parse(raw); } catch (e) { } } if (memDb) return memDb; var db = getCore().seed(); saveDb(db); return db; }
    function saveDb(db) { memDb = db; store(DB_KEY, JSON.stringify(db)); }
    function detect() {
      if (location.protocol.indexOf("http") !== 0) return Promise.resolve("demo");
      return fetch("/api/health", { cache: "no-store", credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && d.lumina ? "server" : "demo"; })
        .catch(function () { return "demo"; });
    }
    function mode() { if (!modeP) modeP = detect(); return modeP; }
    function serverRequest(method, url, body) {
      var o = { method: method, credentials: "same-origin", headers: {} };
      if (method !== "GET") { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body || {}); }
      return fetch(url, o).then(function (r) {
        return r.text().then(function (t) {
          var d; try { d = t ? JSON.parse(t) : {}; } catch (e) { throw HttpError(502, "The server sent an unexpected response. Please restart start.bat."); }
          if (!r.ok) throw HttpError(r.status, d.error || "Something went wrong");
          return d;
        });
      });
    }
    function demoRequest(method, url, body) {
      return new Promise(function (resolve) { setTimeout(resolve, 120); }).then(function () {
        var u = new URL(url, location.href), path = u.pathname.replace(/^.*?(\/api\/)/, "/api/"), query = {};
        u.searchParams.forEach(function (v, k) { query[k] = v; });
        var db = loadDb(), c = getCore();
        var sid = store(SESSION_KEY) || memSession;
        var me = sid ? db.users.filter(function (x) { return x.id === sid && x.active; })[0] || null : null;
        if (path === "/api/health") return { ok: true, lumina: true, mode: "demo" };
        if (path === "/api/login" && method === "POST") {
          var user = c.login(db, body.email, body.password); saveDb(db);
          memSession = user.id; store(SESSION_KEY, user.id);
          return { user: c.pub(user) };
        }
        if (path === "/api/logout") { memSession = null; store(SESSION_KEY, null); return { ok: true }; }
        var out = c.handle(db, me, method, path, clone(body || {}), query);
        if (method !== "GET") saveDb(db);
        return clone(out.data);
      });
    }
    return {
      mode: mode,
      request: function (method, url, body) { return mode().then(function (m) { return m === "server" ? serverRequest(method, url, body) : demoRequest(method, url, body); }); },
      resetDemo: function () { store(DB_KEY, null); store(SESSION_KEY, null); memDb = null; memSession = null; },
    };
  }

  return { create: create, client: client };
});
