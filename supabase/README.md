# USC Supabase backend setup

This repository now includes a Supabase Postgres schema for student records and a server-side AI chat function. The OpenAI key is kept in Supabase Edge Function secrets, never in browser code.

## 1. Create/configure Supabase

1. Create a Supabase project and keep its database password private.
2. In **Project Settings → API**, copy the Project URL and the `anon`/publishable key. These are intended for the browser; never expose the `service_role` key.
3. In **SQL Editor**, run `supabase/migrations/202611050001_student_database.sql`.
4. In **Authentication → Providers**, enable the sign-in provider you intend to use and configure allowed site URLs/redirects.

The schema enables row-level security. A signed-in student can read only their own student record. Admins can manage student records. New Auth users receive the `student` role automatically; a client cannot set its own role.

## 2. Create the first admin and student records

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

## 3. Deploy the AI assistant function

Install the Supabase CLI, log in, link the project, then from the repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY APP_ORIGIN=https://YOUR_SITE_DOMAIN
supabase functions deploy ai-chat
```

`APP_ORIGIN` should be the exact deployed website origin. Do not commit provider keys or the Supabase service-role key. The function requires a valid signed-in Supabase user and accepts only a limited text conversation; it does not read or send student database records to the AI provider. Configure usage limits/billing with your AI provider and consider gateway-level rate limiting before public production use.

## 4. Frontend integration still required

`index.html` currently implements login and data storage with browser `localStorage`; adding this backend does not automatically migrate existing browser data or replace that authentication. To use the database in the live portal, configure the Supabase project URL/public anon key in the browser client, migrate the UI's student CRUD/login to Supabase Auth and `public.students`, and call the authenticated `ai-chat` Edge Function from `aiSend()`. Never put the `service_role` key or `OPENAI_API_KEY` in `index.html`. Export/backup existing local data before any migration; it is not automatically uploaded.
