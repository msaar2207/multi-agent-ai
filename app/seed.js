// Use your DB
// use quran_rag_ai;

// 1. Insert Organization
const orgId = ObjectId();
db.organizations.insertOne({
  _id: orgId,
  name: "DCC Research Org",
  head_user_id: null, // to be linked after user creation
  usage_quota: {
    total_limit: 100000,
    used: 0,
    reset_date: null,
  },
  agents: [],
});

// 2. Insert organization_head
const headId = ObjectId();
db.users.insertOne({
  _id: headId,
  email: "orghead@example.com",
  password: "hashed_password_here", // Use your hashing logic in backend
  role: "organization_head",
  organization_id: orgId,
  agent_id: null,
  quota: {
    monthly_limit: 10000,
    used: 0,
    reset_date: null,
  },
});

// Link head_user_id to organization
db.organizations.updateOne({ _id: orgId }, { $set: { head_user_id: headId } });

// 3. Insert organization_users
const userIds = [];
for (let i = 1; i <= 3; i++) {
  const uid = ObjectId();
  userIds.push(uid);
  db.users.insertOne({
    _id: uid,
    email: `user${i}@example.com`,
    password: "hashed_password_here",
    role: "organization_user",
    organization_id: orgId,
    agent_id: null,
    quota: {
      monthly_limit: 5000,
      used: 0,
      reset_date: null,
    },
  });
}

// 4. Insert agents and assign to org
const agentIds = [];
for (let i = 1; i <= 2; i++) {
  const aid = ObjectId();
  agentIds.push(aid);
  db.agents.insertOne({
    _id: aid,
    name: `Agent ${i}`,
    organization_id: orgId,
    created_by: headId,
    default_prompt: "You are a Quran AI assistant...",
    files: [],
  });
}

// Attach agent list to org
db.organizations.updateOne({ _id: orgId }, { $set: { agents: agentIds } });
