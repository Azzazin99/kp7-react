# Server Actions & Forms

Next.js 15 and React 19 introduce powerful new hooks and components for handling forms and mutations.

## `useActionState` (Replaces `useFormState`)

Use `useActionState` to handle form state, errors, and responses from Server Actions.

```tsx
'use client';

import { useActionState } from 'react';
import { createPost } from '@/app/actions';

const initialState = { message: null, errors: {} };

export default function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, initialState);

  return (
    <form action={formAction}>
      <input name="title" />
      {state.errors?.title && <p className="error">{state.errors.title}</p>}
      
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      
      {state.message && <p>{state.message}</p>}
    </form>
  );
}
```

## `next/form` Component

Next.js 15 introduces the `<Form>` component which extends the standard HTML `<form>` with prefetching, client-side navigation on submission, and progressive enhancement.

```tsx
import Form from 'next/form';

export default function SearchForm() {
  return (
    <Form action="/search" scroll={false}>
      {/* On submit, navigates to /search?query=... without full reload */}
      <input name="query" placeholder="Search..." />
      <button type="submit">Search</button>
    </Form>
  );
}
```

## `useFormStatus`

Use `useFormStatus` inside child components of a form to read its pending state.

```tsx
'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}
```

## Validation Pattern with Zod

Server Actions should always validate their inputs securely on the server.

```tsx
'use server';

import { z } from 'zod';

const schema = z.object({
  title: z.string().min(3),
});

export async function createPost(prevState: any, formData: FormData) {
  const validatedFields = schema.safeParse({
    title: formData.get('title'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed',
    };
  }

  // Save to database
  await db.post.create({ data: validatedFields.data });
  
  return { message: 'Success!' };
}
```
