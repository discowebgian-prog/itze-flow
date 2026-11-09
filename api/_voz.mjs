// GENERADO por scripts/voz-api.mjs desde src/lib/voice.ts. No editar a mano.

// src/lib/dates.ts
var TODAY = /* @__PURE__ */ new Date();
var fmt = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
var addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
var parseD = (s) => {
  const [y, m, d] = s.split("-");
  return new Date(y, m - 1, d);
};
var currency = (n) => "$ " + Number(n).toLocaleString("es-MX");

// src/lib/constants.ts
var INIT_RES = [
  {
    id: "r1",
    propertyId: "hostel",
    guestName: "Luc\xEDa Torres",
    checkIn: fmt(addDays(TODAY, -3)),
    checkOut: fmt(addDays(TODAY, 3)),
    status: "hospedado",
    totalAmount: 45e3,
    paid: 45e3,
    source: "Booking",
    room: "P1"
  }
];

// src/lib/groups.ts
var bookerOf = (r) => ({
  name: r.guestName || "",
  doc: r.guestDoc || "",
  docType: r.guestDocType || "",
  nationality: r.guestNationality || "",
  phonePrefix: r.guestPhonePrefix || "",
  phone: r.guestPhone || "",
  email: r.guestEmail || ""
});
function groupBooker(members) {
  const withSnap = members.find((m) => m.grupoReservante && m.grupoReservante.name);
  if (withSnap) return withSnap.grupoReservante;
  const tit = members.find((m) => m.grupoTitular) || members[0];
  return tit ? bookerOf(tit) : null;
}
var groupName = (members) => groupBooker(members)?.name || "";

// src/lib/availability.ts
var listY = (a) => a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`;

// src/lib/voice.ts
var roomsText = (rooms) => listY(rooms.filter(Boolean));
var debe = (list) => list.reduce((s, r) => s + Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paid) || 0)), 0);
var whoOf = (r) => String(r?.guestName || "").trim();
var nowMerida = () => new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Merida" }));
function greeting(name, now = nowMerida()) {
  const h = now.getHours();
  const [txt, emoji] = h >= 5 && h < 12 ? ["Buen d\xEDa", "\u2600\uFE0F"] : h >= 12 && h < 19 ? ["Buenas tardes", "\u{1F324}\uFE0F"] : ["Buenas noches", "\u{1F319}"];
  return { text: name ? `${txt}, ${name}` : txt, emoji };
}
var live = (r) => r && !r.deleted && r.status !== "cancelada" && r.status !== "eliminada";
function units(list) {
  const out = [];
  const byGroup = {};
  list.forEach((r) => {
    if (r.grupoId) {
      if (!byGroup[r.grupoId]) {
        byGroup[r.grupoId] = { group: true, res: [] };
        out.push(byGroup[r.grupoId]);
      }
      byGroup[r.grupoId].res.push(r);
    } else out.push({ group: false, res: [r] });
  });
  return out.map((u) => {
    const rooms = u.res.map((r) => r.room).filter(Boolean);
    const tit = u.res.find((r) => r.grupoTitular) || u.res[0];
    const name = u.group ? groupName(u.res) || whoOf(tit) : whoOf(tit);
    return {
      ...u,
      name,
      rooms,
      people: u.res.reduce((s, r) => s + (Number(r.totalGuests) || 1), 0),
      debt: debe(u.res),
      label: u.group && u.res.length > 1 ? `el grupo de ${name || "sin nombre"} (${roomsText(rooms)})` : `${name || "alguien"}${rooms.length ? ` (${roomsText(rooms)})` : ""}`
    };
  });
}
function moves(list, one, many) {
  const u = units(list);
  if (!u.length) return "";
  if (u.length === 1) return `${one} ${u[0].label}`;
  if (u.length === 2) return `${many} ${u[0].label} y ${u[1].label}`;
  return `${many} ${u.length} reservas`;
}
var cap1 = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
function whoList(u) {
  if (u.length <= 3) return listY(u.map((x) => x.label));
  return `${u.slice(0, 2).map((x) => x.label).join(", ")} y ${u.length - 2} m\xE1s`;
}
function progress(pending, done, did1, didN, will1, willN, hoy1, hoyN, allDone) {
  const d = units(done);
  const split = new Set(
    units(pending).filter((u) => u.group && d.some((x) => x.group && x.res[0].grupoId === u.res[0].grupoId)).map((u) => u.res[0].grupoId)
  );
  const relabel = (u, word) => u.group && split.has(u.res[0].grupoId) ? { ...u, label: `${word} grupo de ${u.name || "sin nombre"} (${roomsText(u.rooms)})` } : u;
  const p = units(pending).map((u) => relabel(u, "el resto del"));
  d.forEach((u, i) => d[i] = relabel(u, "parte del"));
  if (!p.length && !d.length) return "";
  if (!d.length) return `${p.length === 1 ? hoy1 : hoyN} ${whoList(p)}.`;
  if (!p.length) return d.length === 1 ? `Ya ${did1} ${d[0].label} \u2713` : allDone;
  const ya = d.length === 1 ? `Ya ${did1} ${d[0].label}` : `Ya ${didN} ${d.length} de ${d.length + p.length}`;
  return `${ya}; falta que ${p.length === 1 ? will1 : willN} ${whoList(p)}.`;
}
function daySummary(reservations, now = nowMerida()) {
  const today = fmt(now);
  const tomorrow = fmt(addDays(parseD(today), 1));
  const all = reservations.filter(live);
  const arrivals = all.filter((r) => r.checkIn === today && r.status === "por_llegar");
  const departures = all.filter((r) => r.checkOut === today && r.status === "hospedado");
  const doneIn = all.filter((r) => r.checkIn === today && r.status === "hospedado").length;
  const doneOut = all.filter((r) => r.checkOut === today && r.status === "finalizada").length;
  const night = now.getHours() >= 19;
  const lines = [];
  const inDone = all.filter((r) => r.checkIn === today && (r.status === "hospedado" || r.status === "finalizada"));
  const outDone = all.filter((r) => r.checkOut === today && r.status === "finalizada");
  const started = !night && (inDone.length > 0 || outDone.length > 0);
  const hoy = night ? [moves(arrivals, "que llegue", "que lleguen"), moves(departures, "que se vaya", "que se vayan")].filter(Boolean) : [moves(arrivals, "llega", "llegan"), moves(departures, "se va", "se van")].filter(Boolean);
  if (hoy.length) {
    if (started) {
      lines.push(
        ...[
          progress(arrivals, inDone, "lleg\xF3", "llegaron", "llegue", "lleguen", "Hoy llega", "Hoy llegan", "Ya llegaron todos los de hoy \u2713"),
          progress(departures, outDone, "se fue", "se fueron", "se vaya", "se vayan", "Hoy se va", "Hoy se van", "Ya se fueron todos los de hoy \u2713")
        ].filter(Boolean)
      );
    } else lines.push(night ? `Todav\xEDa falta ${hoy.join(" y ")}.` : `Hoy ${hoy.join(" y ")}.`);
    units(night ? [] : departures).filter((u) => u.res.some((r) => r.lateCheckout)).slice(0, 2).forEach((u) => {
      const h = u.res.find((r) => r.lateCheckout).lateCheckout;
      lines.push(`${cap1(u.label)} sale a las ${h} con late check-out.`);
    });
    const conSaldo = units(arrivals).filter((u) => u.debt > 0);
    if (conSaldo.length === 1) lines.push(`${cap1(conSaldo[0].name || "Alguien")} llega con saldo de ${currency(conSaldo[0].debt)}.`);
    else if (conSaldo.length > 1) lines.push(`${conSaldo.length} de las que llegan tienen saldo por cobrar.`);
  } else if (doneIn || doneOut) {
    lines.push("Los movimientos de hoy ya est\xE1n hechos \u2713");
  } else if (!night) {
    lines.push("D\xEDa tranquilo: nadie entra ni sale hoy.");
  }
  if (night) {
    const mIn = all.filter((r) => r.checkIn === tomorrow && r.status === "por_llegar");
    const mOut = all.filter((r) => r.checkOut === tomorrow && r.status !== "finalizada");
    const man = [moves(mIn, "llega", "llegan"), moves(mOut, "se va", "se van")].filter(Boolean);
    lines.push(man.length ? `Ma\xF1ana ${man.join(" y ")}.` : "Ma\xF1ana no hay entradas ni salidas.");
  }
  return lines;
}
export {
  daySummary,
  greeting,
  nowMerida
};
