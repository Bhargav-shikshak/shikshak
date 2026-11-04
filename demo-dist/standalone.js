import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
const catalog = {
  city: "Guwahati, Assam",
  center: { lat: 26.168, lng: 91.765 },
  defaultLocality: "rajgarh",
  localities: [
    { id: "rajgarh", name: "Rajgarh", lat: 26.1743, lng: 91.7661 },
    { id: "chandmari", name: "Chandmari", lat: 26.1843, lng: 91.771 },
    { id: "zoo-road", name: "Zoo Road", lat: 26.1705, lng: 91.7838 },
    { id: "ulubari", name: "Ulubari", lat: 26.1677, lng: 91.754 },
    { id: "beltola", name: "Beltola", lat: 26.1278, lng: 91.807 },
    { id: "dispur", name: "Dispur", lat: 26.1448, lng: 91.7897 },
    { id: "ganeshguri", name: "Ganeshguri", lat: 26.1536, lng: 91.7823 },
    { id: "silpukhuri", name: "Silpukhuri", lat: 26.1861, lng: 91.7608 },
    { id: "paltan-bazaar", name: "Paltan Bazaar", lat: 26.1756, lng: 91.7508 },
    { id: "uzan-bazaar", name: "Uzan Bazaar", lat: 26.1944, lng: 91.7535 },
    { id: "birubari", name: "Birubari", lat: 26.1555, lng: 91.7473 }
  ],
  subjects: ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Science", "Computer Science", "Assamese", "Social Studies"],
  grades: ["Classes 1–5", "Classes 6–8", "Classes 9–10", "Classes 11–12", "College"],
  workspaces: {
    student: { id: "demo-student", role: "student", name: "Aditi", initials: "AD" },
    teacher: { id: "demo-teacher", role: "teacher", name: "Arjun", initials: "AR" }
  },
  demo: true
};
const teachers = [
  ["t-riya", "Riya Sharma", "Maths & Physics tutor", "rajgarh", ["Mathematics", "Physics"], [2, 3], 550, "Weekday evenings", "I help students turn tricky concepts into simple steps. Sessions combine worked examples with practice at your pace. I can help with board exams, weekly revision and building confidence in problem solving.", "lilac"],
  ["t-arindam", "Arindam Das", "Science & Maths tutor", "silpukhuri", ["Science", "Mathematics"], [1, 2], 450, "Mon, Wed & weekends", "I work with middle and secondary school students on foundations in maths and science. I start with what you already know and build from there with exercises and short reviews.", "peach"],
  ["t-meghna", "Meghna Bora", "English & reading tutor", "zoo-road", ["English", "Social Studies"], [0, 1], 400, "After school", "I use stories, guided reading and conversation to help younger learners feel comfortable with English. I also support homework and writing practice.", "sage"],
  ["t-niloy", "Niloy Deka", "Physics & Chemistry tutor", "ulubari", ["Physics", "Chemistry"], [2, 3], 650, "Weekends", "Hands-on explanations and structured practice for school science. We can focus on a particular chapter, prepare for exams, or set up a regular weekly routine.", "blue"],
  ["t-jahnavi", "Jahnavi Hazarika", "Biology & Science tutor", "chandmari", ["Biology", "Science"], [1, 2, 3], 500, "Tue & Thu evenings", "I bring diagrams and clear notes to each session. I enjoy helping students see how topics connect and understand what exam questions are asking.", "peach"],
  ["t-rahul", "Rahul Kalita", "Coding & Maths tutor", "ganeshguri", ["Computer Science", "Mathematics"], [2, 3, 4], 700, "Flexible weekdays", "Learn coding and maths through small projects and worked examples. I teach Python and school-level problem solving.", "lilac"],
  ["t-ananya", "Ananya Saikia", "Primary school tutor", "uzan-bazaar", ["English", "Assamese", "Mathematics"], [0], 350, "Weekday afternoons", "Friendly tuition for early readers and primary school learners. We practise core skills through short activities.", "sage"],
  ["t-saurav", "Saurav Baruah", "Maths & Physics tutor", "beltola", ["Mathematics", "Physics"], [2, 3], 600, "Saturday & Sunday", "I offer regular maths and physics support for secondary school and board exam students, with time to review questions from class.", "blue"]
];
const students = [
  ["s-kashyap", "Kashyap family", "Looking for a Maths tutor", "rajgarh", ["Mathematics"], [2], 550, "Weekday evenings", "Looking for a tutor for Class 10 maths, twice a week after school. We would like to start with algebra and exam-style questions.", "sage"],
  ["s-dutta", "Dutta family", "English reading support", "silpukhuri", ["English"], [0], 400, "After school", "We are looking for gentle reading and writing practice for a primary school learner. Two short lessons a week would work well.", "blue"],
  ["s-bora", "Bora family", "Physics & Chemistry tuition", "zoo-road", ["Physics", "Chemistry"], [3], 700, "Weekends", "Looking for regular support with Class 11 science and help with numerical problems. Weekend mornings are best for us.", "peach"],
  ["s-roy", "Roy family", "Science homework support", "chandmari", ["Science"], [1], 450, "Mon & Wed evenings", "We want help understanding classroom science and keeping up with homework.", "lilac"],
  ["s-kalita", "Kalita family", "Computer Science lessons", "ganeshguri", ["Computer Science"], [3], 650, "Flexible weekdays", "Looking for a Python tutor who can explain core programming concepts and guide us through a few small projects.", "blue"],
  ["s-saikia", "Saikia family", "Assamese & English tuition", "paltan-bazaar", ["Assamese", "English"], [0, 1], 500, "Weekday afternoons", "We would like regular language practice with a tutor who can build confidence in reading and conversation.", "sage"]
];
function makeListings(role, records) {
  return records.map(([id, name, headline, localityId, subjects, grades, rate, availability, description, color], index) => {
    const locality = catalog.localities.find((area) => area.id === localityId);
    return {
      id,
      role,
      name,
      headline,
      localityId,
      subjects,
      grades: grades.map((grade) => catalog.grades[grade]),
      rate,
      availability,
      description,
      published: true,
      avatar: index + 1,
      color,
      locality: locality.name,
      location: { lat: locality.lat, lng: locality.lng }
    };
  });
}
const seedListings = [...makeListings("teacher", teachers), ...makeListings("student", students)];
function initialState() {
  return { own: {}, saves: {}, interests: { "t-riya": ["demo-student"], "s-kashyap": ["demo-teacher"] }, messages: {} };
}
const opposite = (role) => role === "student" ? "teacher" : "student";
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) => json({ message }, status);
const pairKey = (a, b) => [a, b].sort().join(":");
function statusFor(state, me, other) {
  const outgoing = state.interests[me]?.includes(other);
  const incoming = state.interests[other]?.includes(me);
  if (outgoing && incoming) return "matched";
  if (incoming) return "incoming";
  return outgoing ? "sent" : null;
}
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (a.lat - b.lat) * rad;
  const dLng = (a.lng - b.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
function cleanText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function validValues(value, allowed) {
  return Array.isArray(value) ? allowed.filter((item) => value.includes(item)) : [];
}
function listingFrom(input, role) {
  if (!input || typeof input !== "object") return null;
  const data = input;
  const name = cleanText(data.name, 60);
  const headline = cleanText(data.headline, 90);
  const availability = cleanText(data.availability, 100);
  const description = cleanText(data.description, 700);
  const locality = catalog.localities.find((area) => area.id === data.localityId);
  const subjects = validValues(data.subjects, catalog.subjects);
  const grades = validValues(data.grades, catalog.grades);
  const rate = data.rate;
  if (!name || !headline || !availability || !description || !locality || !subjects.length || !grades.length || typeof rate !== "number" || !Number.isInteger(rate) || rate < 50 || rate > 1e4) return null;
  return {
    id: catalog.workspaces[role].id,
    role,
    name,
    headline,
    availability,
    description,
    localityId: locality.id,
    locality: locality.name,
    location: { lat: locality.lat, lng: locality.lng },
    subjects,
    grades,
    rate,
    published: data.published === true,
    avatar: 0,
    color: role === "student" ? "sage" : "peach"
  };
}
async function demoApi(request, state) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = request.method;
  if (parts.join("/") === "api/v1/catalog" && method === "GET") return json(catalog);
  const role = parts[3];
  if (parts[0] !== "api" || parts[1] !== "v1" || parts[2] !== "workspaces" || role !== "student" && role !== "teacher") {
    return fail("This endpoint could not be found.", 404);
  }
  const me = catalog.workspaces[role].id;
  const others = [...seedListings, ...Object.values(state.own)].filter((item) => item.role === opposite(role));
  const [, , , , resource, id, action] = parts;
  if (parts.length === 5 && resource === "listing") {
    if (method === "GET") return json(state.own[role] ?? null);
    if (method === "PUT") {
      const listing = listingFrom(await request.json().catch(() => null), role);
      if (!listing) return fail("Complete all fields and enter a whole hourly rate between ₹50 and ₹10,000.");
      state.own[role] = listing;
      return json(listing);
    }
  }
  if (parts.length === 5 && resource === "discovery" && method === "GET") {
    const params = url.searchParams;
    const origin = catalog.localities.find((area) => area.id === params.get("locality")) ?? catalog.localities.find((area) => area.id === state.own[role]?.localityId) ?? catalog.localities.find((area) => area.id === catalog.defaultLocality);
    const query = (params.get("query") ?? "").toLowerCase().trim();
    const radius = Number(params.get("radius")) || Infinity;
    const maxRate = Number(params.get("maxRate")) || Infinity;
    const subject = params.get("subject");
    const grade = params.get("grade");
    const published = others.filter((item) => item.published);
    const listings = published.map((item) => ({
      ...item,
      distance: distanceKm(origin, item.location),
      saved: state.saves[me]?.includes(item.id) ?? false,
      connection: statusFor(state, me, item.id)
    })).filter(
      (item) => (!subject || item.subjects.includes(subject)) && (!grade || item.grades.includes(grade)) && item.rate <= maxRate && item.distance <= radius && (params.get("saved") !== "true" || item.saved) && (!query || [item.name, item.headline, item.locality, ...item.subjects].some((value) => value.toLowerCase().includes(query)))
    );
    listings.sort((a, b) => params.get("sort") === "rate" ? a.rate - b.rate || a.distance - b.distance : a.distance - b.distance);
    return json({ listings, origin: { lat: origin.lat, lng: origin.lng }, total: published.length });
  }
  if (parts.length === 5 && resource === "connections" && method === "GET") {
    const connections = others.flatMap((listing) => {
      const status = statusFor(state, me, listing.id);
      return status && (listing.published || status === "matched") ? [{ listing, status }] : [];
    });
    return json(connections);
  }
  const target = others.find((item) => item.id === id);
  if (parts.length === 7 && resource === "listings" && target?.published) {
    if (action === "save" && method === "PUT") {
      const data = await request.json().catch(() => null);
      if (typeof data?.saved !== "boolean") return fail("Choose whether to save this listing.");
      const saved = new Set(state.saves[me] ?? []);
      if (data.saved) saved.add(target.id);
      else saved.delete(target.id);
      state.saves[me] = [...saved];
      return json({ saved: data.saved });
    }
    if (action === "interest" && method === "PUT") {
      state.interests[me] = [.../* @__PURE__ */ new Set([...state.interests[me] ?? [], target.id])];
      return json({ status: statusFor(state, me, target.id) });
    }
  }
  if (parts.length === 7 && resource === "connections" && action === "messages" && target) {
    if (statusFor(state, me, target.id) !== "matched") return fail("Messaging opens after a mutual match.", 403);
    const key = pairKey(me, target.id);
    const messages = state.messages[key] ?? [];
    if (method === "GET") return json(messages);
    if (method === "POST") {
      const data = await request.json().catch(() => null);
      const body = cleanText(data?.body, 500);
      const id2 = cleanText(data?.id, 60);
      if (!body || !id2) return fail("Enter a message before sending.");
      const previous = messages.find((message2) => message2.id === id2 && message2.authorId === me);
      if (previous) return json(previous);
      const message = { id: id2, body, authorId: me, sentAt: (/* @__PURE__ */ new Date()).toISOString() };
      state.messages[key] = [...messages.slice(-99), message];
      return json(message, 201);
    }
  }
  return fail("This endpoint or listing could not be found.", 404);
}
function sessionFor(request) {
  const existing = request.headers.get("cookie")?.match(/(?:^|;\s*)studylane_demo=([a-f0-9-]{36})(?:;|$)/i)?.[1];
  const id = existing ?? crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return { id, cookie: existing ? null : "studylane_demo=" + id + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800" + secure };
}
function withCookie(response, cookie) {
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
}
function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
function localApi(folder, log = console.error) {
  const locks = /* @__PURE__ */ new Map();
  return async (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next();
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
      const bodyParts = [];
      let length = 0;
      for await (const part of req) {
        length += part.length;
        if (length > 16384) {
          res.writeHead(413).end();
          return;
        }
        bodyParts.push(part);
      }
      const request = new Request("http://" + req.headers.host + req.url, {
        method: req.method,
        headers,
        body: bodyParts.length ? Buffer.concat(bodyParts) : void 0
      });
      if (!allowedOrigin(request)) {
        res.writeHead(403).end();
        return;
      }
      const session = sessionFor(request);
      const path = resolve(folder, session.id + ".json");
      const work = (locks.get(session.id) ?? Promise.resolve()).catch(() => {
      }).then(async () => {
        let state;
        try {
          state = JSON.parse(await readFile(path, "utf8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          state = initialState();
        }
        const response = await demoApi(request, state);
        if (request.method !== "GET" && response.ok) {
          await mkdir(folder, { recursive: true });
          await writeFile(path + ".tmp", JSON.stringify(state));
          await rename(path + ".tmp", path);
        }
        return withCookie(response, session.cookie);
      });
      locks.set(session.id, work);
      let result;
      try {
        result = await work;
      } finally {
        if (locks.get(session.id) === work) locks.delete(session.id);
      }
      res.writeHead(result.status, Object.fromEntries(result.headers.entries()));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      log(String(error));
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "The demo API could not complete this request." }));
    }
  };
}
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};
const project = fileURLToPath(new URL("..", import.meta.url));
const publicDir = resolve(project, "dist");
const api = localApi(resolve(project, ".demo-data"));
async function staticResponse(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const requested = resolve(publicDir, "." + pathname);
  if (requested !== publicDir && !requested.startsWith(publicDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  const file = extname(requested) ? requested : resolve(publicDir, "index.html");
  try {
    const bytes = await readFile(file);
    res.writeHead(200, { "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? void 0 : bytes);
  } catch {
    res.writeHead(404).end("File not found. Run npm run build to regenerate the demo.");
  }
}
const port = Number(process.env.PORT ?? 4173);
const server = createServer((req, res) => {
  const host = req.headers.host?.split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") {
    res.writeHead(403).end();
    return;
  }
  void api(req, res, () => {
    void staticResponse(req, res);
  });
});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") console.log("Studylane demo: http://127.0.0.1:" + address.port + "/");
});
