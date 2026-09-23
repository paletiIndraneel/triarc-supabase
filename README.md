# triarc-web

TriArc-Web — Supabase Authentication Implementation Requirements
================================================================
Repository
----------
Repository: sakethram9/triarc-web
Branch: development
Purpose
-------
Migrate the existing TriArc-Web admin authentication from the current custom
username/password + HMAC session implementation to Supabase Authentication.

The implementation must preserve the existing website, admin UI, deployment
architecture, and unrelated functionality.

The person implementing this change should use this document as the
implementation requirement and make the required code/configuration changes.


1. TARGET AUTHENTICATION FLOW
-----------------------------

Current flow:

    /signin
       |
       v
    Username + Password
       |
       v
    /api/auth/login
       |
       v
    ADMIN_USERNAME + ADMIN_PASSWORD
       |
       v
    Custom HMAC session cookie
       |
       v
    /admin


Required flow:

    /signin
       |
       v
    Supabase Email + Password
       |
       v
    Supabase Auth Session
       |
       v
    Authenticate Supabase user
       |
       v
    Check public.admin_users
       |
       v
    Verify:
        user_id matches
        role = admin
        active = true
       |
       v
    /admin


2. SUPABASE PROJECT
-------------------

Supabase project URL:

    https://kgfxlqgbzvtqfrqbblfo.supabase.co


Supabase Auth is the source of truth for user authentication.

Do not implement a separate password database or custom password validation.


3. ADMIN USER MANAGEMENT
------------------------

Administrators will be managed directly in Supabase.

The application must NOT hard-code:

    admin email addresses
    admin user IDs
    admin usernames
    admin passwords


The application must support any number of administrators.

To add an administrator:

    1. Create the user in Supabase Authentication → Users.
    2. Take the user's Supabase Auth UUID.
    3. Add that UUID to public.admin_users.
    4. Set role = 'admin'.
    5. Set active = true.


To disable an administrator:

    Set:

        active = false


To permanently remove administrator authorization:

    Remove the corresponding row from:

        public.admin_users


No application code change should be required when administrators are
added, removed, enabled, or disabled.


4. EXISTING ADMIN USER
----------------------

An initial Supabase user has already been created for testing:

    Email:
        triarcgroup9@gmail.com

    Auth User ID:
        f95622ac-c664-4fdd-8880-c651b005afa9


This user is already present in:

    public.admin_users


with:

    role = admin
    active = true


IMPORTANT:

The above email address and UUID are provided only as the current test/admin
account.

DO NOT hard-code this email address or UUID anywhere in the application.


5. ADMIN AUTHORIZATION TABLE
----------------------------

Existing table:

    public.admin_users


Expected structure:

    user_id     UUID
    role        TEXT
    active      BOOLEAN
    created_at  TIMESTAMPTZ


The table is linked to:

    auth.users(id)


RLS is enabled.

Existing authorization policy allows an authenticated user to read their own
active admin record.


6. AUTHORIZATION RULE
---------------------

A valid Supabase login does NOT automatically mean the user is an admin.

The application must perform two separate checks:


CHECK 1 — AUTHENTICATION

Verify that the user has successfully authenticated through Supabase Auth.


CHECK 2 — ADMIN AUTHORIZATION

Verify that the authenticated user's UUID exists in:

    public.admin_users


and that:

    active = true

and:

    role = 'admin'


Therefore:

    Authenticated User
           |
           v
    user.id
           |
           v
    public.admin_users
           |
           +---- matching user_id?
           |
           +---- role = admin?
           |
           +---- active = true?
           |
           v
       /admin access


If any check fails:

    /admin access must be denied.


7. SUPABASE ENVIRONMENT VARIABLES
---------------------------------

Add the following application environment variables:

    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY


NEXT_PUBLIC_SUPABASE_URL:

    https://kgfxlqgbzvtqfrqbblfo.supabase.co


The publishable key must come from the Supabase project configuration.

Do not hard-code the key in source code.

Do not commit private Supabase service-role/secret keys.

Do not expose service-role credentials to browser/client-side code.


8. SUPABASE CLIENT
------------------

Create an appropriate reusable Supabase client/helper under src/lib/.

The implementation must support the existing TriArc-Web architecture.

Preferred package:

    @supabase/supabase-js


Use:

    @supabase/ssr

if required for the final cookie/session implementation.

The implementation must remain compatible with:

    Next.js 15
    React 19
    Cloudflare Pages
    Cloudflare Pages Functions
    Current TriArc-Web deployment architecture


Do not introduce a Node-only authentication server.


9. SIGN-IN FORM
---------------

Current file:

    src/components/Admin/SignInForm.tsx


Current fields:

    Username
    Password


Required fields:

    Email
    Password


Replace the custom:

    POST /api/auth/login


with Supabase authentication:

    supabase.auth.signInWithPassword()


Use:

    email
    password


The existing TriArc visual design should remain unchanged.

Do not redesign the sign-in page.


On successful authentication:

    Navigate to /admin


On authentication failure:

    Display a clear user-friendly error message.


Do not expose unnecessary internal Supabase error details.


10. SIGN-IN PAGE
----------------

Current file:

    src/app/signin/page.tsx


Keep:

    Existing page layout
    GlassCard
    Existing styling
    "Admin Sign In"
    "Restricted access."


Only the authentication form behavior needs to change.


11. /ADMIN PROTECTION
---------------------

Current protection file:

    functions/admin/_middleware.ts


The current implementation validates the custom:

    triarc_admin_session


and:

    SESSION_SECRET


This must be replaced with Supabase-based authentication and authorization.


IMPORTANT:

The current application uses Cloudflare Pages/Functions and static export
architecture.

Do NOT blindly copy a standard Next.js middleware implementation if it is
incompatible with the existing Cloudflare deployment.

The final implementation must work with the actual TriArc-Web deployment
architecture.


The /admin protection must:

    1. Read the Supabase authentication session.
    2. Verify the authenticated user.
    3. Obtain the authenticated user's UUID.
    4. Check public.admin_users.
    5. Require role = admin.
    6. Require active = true.
    7. Allow the request only when all checks pass.


Unauthenticated user:

    Redirect to /signin


Authenticated but non-admin user:

    Deny access to /admin
    Redirect to /signin


Inactive admin:

    Deny access to /admin
    Redirect to /signin


12. SECURITY
------------

Do not rely solely on client-side checks such as:

    isAdmin = true


Authorization must be enforced server/edge side.

Do not trust a value supplied by the browser to determine administrator
status.

The authenticated user's Supabase UUID must be checked against:

    public.admin_users


Do not use email address as the primary authorization key.

Use:

    auth.users.id

and:

    public.admin_users.user_id


13. LOGOUT
----------

Current file:

    src/components/Admin/LogoutButton.tsx


Current behavior:

    POST /api/auth/logout


Replace this with:

    supabase.auth.signOut()


After successful logout:

    Navigate to /signin


The existing logout button appearance must remain unchanged.


14. OLD LOGIN API
-----------------

Current file:

    functions/api/auth/login.ts


This currently uses:

    ADMIN_USERNAME
    ADMIN_PASSWORD
    SESSION_SECRET


and creates:

    triarc_admin_session


This custom login mechanism should be retired after the Supabase login flow
has been successfully implemented and tested.


Do NOT remove it before the replacement has been verified.


15. OLD LOGOUT API
------------------

Current file:

    functions/api/auth/logout.ts


This currently clears:

    triarc_admin_session


Once Supabase logout is implemented and verified, this custom endpoint can be
retired.


16. OLD SESSION IMPLEMENTATION
------------------------------

Current file:

    functions/_lib/session.ts


This contains:

    createSessionToken()
    verifySessionToken()
    timingSafeEqual()
    SESSION_COOKIE_NAME
    triarc_admin_session


This custom HMAC authentication mechanism is no longer required after the
Supabase implementation is verified.

Retire/remove it only after successful migration and testing.


17. ENVIRONMENT VARIABLES TO RETIRE
-----------------------------------

The following old authentication variables should no longer be required:

    ADMIN_USERNAME
    ADMIN_PASSWORD
    SESSION_SECRET


Remove them from:

    .env.example


only after the Supabase implementation is working.


Keep all unrelated existing environment variables.


18. ADMIN PAGE
-------------

Current file:

    src/app/admin/page.tsx


Keep the existing:

    Admin UI
    Cards
    Links
    Styling
    Metadata
    Logout button


Do not redesign the admin page.

The current text states that the custom admin session lasts 8 hours.

After migration, update this wording because authentication/session lifecycle
will be managed by Supabase instead of the old custom 8-hour HMAC session.


19. MULTIPLE ADMIN SUPPORT
--------------------------

The system MUST support multiple administrators.

Example:

    Admin A
    Admin B
    Admin C


Each administrator should be independently managed through:

    Supabase Authentication
    +
    public.admin_users


Adding Admin D must NOT require a code change.

Removing Admin B must NOT require a code change.

Disabling Admin C must NOT require a code change.


20. RLS
-------

Keep Row Level Security enabled on:

    public.admin_users


The application must work with the existing RLS model.

Do not disable RLS as a shortcut.


21. FILES EXPECTED TO CHANGE
----------------------------

Expected:

    package.json

    .env.example

    src/components/Admin/SignInForm.tsx

    src/components/Admin/LogoutButton.tsx

    functions/admin/_middleware.ts


Potentially new:

    src/lib/supabase.ts

or an equivalent appropriate Supabase client/helper structure.


Potentially retire after successful verification:

    functions/api/auth/login.ts

    functions/api/auth/logout.ts

    functions/_lib/session.ts


Do not modify unrelated public-site components.


22. DO NOT CHANGE
-----------------

Do NOT change:

    Public website design
    Public pages
    Navigation
    Contact form behavior
    Existing business logic
    Existing contact email functionality
    Existing visual styling
    Existing unrelated API functionality
    Existing deployment architecture


This task is specifically for replacing the admin authentication system.


23. TESTING REQUIREMENTS
------------------------

TEST 1 — ADMIN LOGIN

Use:

    triarcgroup9@gmail.com

with the Supabase password.

Expected:

    Supabase authentication succeeds.
    User is authorized through public.admin_users.
    /admin loads.


TEST 2 — WRONG PASSWORD

Expected:

    Login fails.
    /admin remains protected.


TEST 3 — LOGGED OUT USER

Open:

    /admin

without an authenticated session.

Expected:

    Redirect to /signin.


TEST 4 — NON-ADMIN USER

Create another Supabase Auth user.

Do NOT add that user's UUID to:

    public.admin_users


Expected:

    Supabase login can succeed.
    /admin access must still be denied.


TEST 5 — INACTIVE ADMIN

For an existing admin:

    active = false


Expected:

    /admin access is denied.


Restore:

    active = true


Expected:

    /admin access is restored.


TEST 6 — MULTIPLE ADMINS

Create two or more admin users in Supabase.

Add their UUIDs to:

    public.admin_users


Expected:

    Each active admin can access /admin.


TEST 7 — LOGOUT

Login and click:

    Sign Out


Expected:

    Supabase session is terminated.
    User returns to /signin.
    /admin cannot be accessed without signing in again.


TEST 8 — REFRESH

Login and open:

    /admin


Refresh the page.

Expected:

    Valid Supabase session remains available.


TEST 9 — PRODUCTION

After deployment verify:

    Login
    Logout
    /admin protection
    Non-admin protection
    Multiple admin accounts
    Inactive admin protection
    Session persistence


24. IMPLEMENTATION ORDER
------------------------

Follow this order:

    1. Add Supabase dependency.

    2. Add Supabase client/helper.

    3. Configure environment variables.

    4. Update SignInForm.tsx.

    5. Implement Supabase session handling compatible with Cloudflare.

    6. Update /admin middleware.

    7. Add/check admin_users authorization.

    8. Update LogoutButton.tsx.

    9. Build/type-check.

    10. Test locally.

    11. Test admin login.

    12. Test non-admin access.

    13. Test inactive admin access.

    14. Test logout.

    15. Test session persistence.

    16. Test production deployment.

    17. Only after all tests pass, retire the old custom authentication files.


25. CHANGE CONTROL
------------------

Use the current development branch as the baseline.

Make only the changes required for Supabase authentication.

Do not perform unrelated cleanup or refactoring.

Do not redesign the UI.

Do not change public functionality.

Do not remove the existing authentication implementation until the new
Supabase implementation has been tested successfully.

The final result should allow administrators to be managed entirely from
Supabase without requiring future code changes.


END OF REQUIREMENTS
===================
