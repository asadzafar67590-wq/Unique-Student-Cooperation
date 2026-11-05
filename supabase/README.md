# USC Supabase backend setup

This repository includes a Supabase Postgres schema for student records, a browser adapter, and a server-side AI chat function. The OpenAI key is kept in Supabase Edge Function secrets, never in browser code.

## 1. Create/configure Supabase

1. Create a Supabase project and keep its database password private.
2. In **Project Settings → API**, copy the Project URL and the `anon`/publishable key. These are intended for the browser; never expose the `service_role` key.
3. In **SQL Editor**, run `supabase/migrations/202611050001_student_database.sql`.
4. Copy `supabase/config.example.js` to `supabase/config.js` and add your Project URL and anon/publishable key.
5. In **Authentication → Providers**, enable email/password sign-in and configure allowed site URLs/redirects.

The schema enables row-level security. A signed-in student can read only their own student record. Admins can manage student records. New Auth users receive the `student` role automatically; a client cannot set its own role.

## 2. Load the browser adapter

The existing `index.html` is still primarily a localStorage prototype. To load the new adapter, add these scripts after the existing Supabase CDN script and before the app's inline script:

```html
<script src="supabase/config.js"></script>
<script src="supabase/portal-client.js"></script>
```

The adapter exposes `window.USCBackend` methods: `signIn(email, password)`, `signOut()`, `getRole()`, `getMyStudentRecord()`, `listStudents()`, `updateStudent(id, fields)`, and `askAI(messages)`. These methods use Supabase Auth and RLS. UI login, student CRUD, and `aiSend()` still need to be switched from the local demo functions to these methods; do not treat adding the adapter as an automatic migration of the old UI/data.

## 3. Create the first admin and student records

Create an Auth user for the administrator using the Supabase Dashboard. Then, from the SQL Editor (trusted project owner only), promote that user's profile:

```sql
update public.profiles
set role = 'admin', display_name = 'Administrator'
where user_id = 'AUTH_USER_UUID';
```

Create student login users through the Supabase Dashboard or a trusted server using Supabase Auth. Do not create student Auth accounts from browser code with an admin/service key. Each Auth user receives a `profiles` row automatically. As an admin, insert a linked student record (replace the values and UUID):

```sql
insert into public.students (user_id, registration_no, full_name, program, email)
values ('STUDENT_AUTH_USER_UUID', 'REG-001', 'Student Name', 'BS Computer Science', 'student@example.com');
```

Student information was not included in the repository request, so no real student data is preloaded. Keep CNIC and other personal data private and enter it only with authorization.

## 4. Deploy the AI assistant function

Install the Supabase CLI, log in, link the project, then from the repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY APP_ORIGIN=https://YOUR_SITE_DOMAIN
supabase functions deploy ai-chat
```

`APP_ORIGIN` should be the exact deployed website origin. Do not commit provider keys or the Supabase service-role key. The function requires a valid signed-in Supabase user and accepts a limited conversation. It does not read or send student database records to the AI provider. Configure usage limits/billing with your AI provider and consider gateway-level rate limiting before public production use.

## 5. Connect the existing assistant

Once the user is signed in to Supabase, call the adapter from the chat handler, keeping recent messages as `{ role: 'user' | 'assistant', content: string }`:

```js
const answer = await USCBackend.askAI(recentMessages);
```

Display `answer` as text (not HTML). Keep the chat's current loading/error states, and handle an expired session by asking the user to sign in again.

## 6. Important migration and security notes

- Existing `localStorage` records are not automatically uploaded; export/backup data before migration.
- Existing localStorage passwords must not be copied to the database. Create Supabase Auth accounts with new credentials and link each Auth UUID to a student record.
- Never put `service_role`, `OPENAI_API_KEY`, or an AI provider key in `index.html` or any browser JavaScript.
- This repository does not contain real student data or Supabase project credentials; configure your own project before the backend can store/access records.
