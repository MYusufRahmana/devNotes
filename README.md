# DevNotes — Personal Technical Knowledge Base

Tempat menyimpan snippet, cheatsheet, troubleshooting, guide, dan artikel teknis, lalu menemukannya lagi dalam waktu kurang dari 10 detik.

Stack: React 19 + TypeScript + Vite · Tailwind CSS v4 · React Router 7 · TanStack Query · Supabase (Auth, Postgres + RLS, Storage) · Shiki · Lucide.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
```

Tanpa konfigurasi apa pun, aplikasi berjalan dalam **demo mode**. Data disimpan di browser (localStorage + IndexedDB) dan sudah berisi contoh catatan. Klik **Sign in → Continue as owner**.

## Menghubungkan Supabase

1. Buat project di Supabase.
2. Buka **SQL Editor**, lalu jalankan berurutan:
   - [`0001_init.sql`](supabase/migrations/0001_init.sql): tabel, trigger, fungsi search, RLS, dan storage bucket.
   - [`0002_cover_image.sql`](supabase/migrations/0002_cover_image.sql): kolom sampul (cover) catatan.

   Keduanya aman dijalankan ulang.
3. **Authentication → Users → Add user**: buat satu akun owner (email + password).
4. **Authentication → Sign In / Providers**: matikan *Allow new users to sign up*. V1 tidak punya registrasi publik.
5. Salin `.env.example` menjadi `.env.local`, lalu isi:

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_PUBLIC_PUBLISHING=true   # false = pengunjung hanya melihat halaman login
   ```

6. Saat login pertama, kategori default (Git, React, Laravel, …) dibuat otomatis.

Deploy ke Vercel: set tiga env di atas. `vercel.json` sudah meng-handle SPA rewrite.

## Fitur

| Area | Detail |
| --- | --- |
| Tipe catatan | Snippet, Cheatsheet, Troubleshooting, Guide, Article, masing-masing punya template. Template ikut berganti saat tipe diubah selama isi belum disentuh. |
| Pencarian | `Ctrl/⌘ K` membuka command palette. Ranking: **title › tag › category › content**, dan setiap kata harus cocok. Hasil lokal muncul seketika, lalu diganti hasil server. Token seperti `optimize:clear` atau `--prune` cocok apa adanya. Snippet konten di-highlight. Ketik `>` untuk command. |
| Editor | Markdown dengan toolbar, `Ctrl+B/I/E`, list berlanjut otomatis saat Enter, Tab indent, paste/drop gambar (upload lalu sisipkan Markdown), paste URL di atas teks terpilih menjadi link, tampilan Write / Split / Preview. |
| Autosave | Debounce 1 detik, antrean serial (tidak pernah ada dua request bersamaan), status *Saving… / Saved / Unsaved changes / Retry*. Backup lokal memulihkan perubahan kalau tab tertutup sebelum sempat tersimpan. Catatan baru tidak dibuat sebelum ada isi, jadi tidak ada draft kosong. |
| Reader | Lebar ±740px, TOC otomatis (≥3 heading, layar lebar), code block dengan highlight Shiki (light/dark), label bahasa, `title="..."`, dan tombol Copy yang membuang prompt `$`. Ada juga related notes (berdasarkan tag/kategori), lampiran, dan anchor heading. |
| Organisasi | Kategori (ikon, urutan, CRUD), tag dengan autocomplete, Favorite, Pin (tampil pertama di Home), Draft, Archive (Undo, Restore, Delete permanen hanya dari Archive). |
| Visibilitas | Private / Public. Public hanya terlihat setelah Published. Slug dikunci setelah publish pertama supaya link tidak putus. |
| Portabilitas | Export satu catatan (.md + frontmatter), export semua (.zip per kategori), import banyak .md (frontmatter → H1 → nama file). |
| Lainnya | Dark mode (system/light/dark), font baca sans/serif, sidebar collapsible (`Ctrl+\`), drawer mobile, shortcut (`?` untuk daftar lengkap). |

### Shortcut utama

`Ctrl/⌘ K` cari · `/` cari · `N` catatan baru · `E` edit · `F` favorite · `P` pin · `Ctrl/⌘ S` simpan · `Ctrl/⌘ Enter` publish · `Esc` kembali · `?` bantuan

## Keamanan

- **RLS wajib di semua tabel.** Pengunjung hanya bisa `SELECT` catatan `PUBLIC + PUBLISHED`. Insert, update, dan delete hanya untuk pemilik. Pengecekan lintas tabel memakai helper `SECURITY DEFINER` agar policy tidak saling rekursif.
- Route guard di React hanya untuk UX. Proteksi sebenarnya ada di database.
- `note-images` adalah bucket publik dengan path `<uid>/<note>/…` yang tidak bisa ditebak. `note-attachments` bersifat privat dan diakses lewat signed URL 5 menit. Lampiran pada catatan publik bisa diunduh pengunjung, lampiran lain tidak.
- File executable ditolak, baik di client maupun lewat `allowed_mime_types` bucket.
- Markdown dirender tanpa raw HTML, jadi isi catatan tidak bisa menyisipkan script.
- `updated_at` hanya berubah saat konten berubah. Toggle pin/favorite tidak mengacak urutan "Recently updated".

## Struktur

```
src/
├── app/            router, providers
├── components/
│   ├── layout/     AppShell, AppSidebar, MobileSidebar, AppHeader, ShortcutsDialog
│   ├── notes/      NoteListItem, NoteCollection, NoteReader, Markdown, TableOfContents, AttachmentList
│   ├── editor/     NoteEditor, EditorToolbar, CodeBlock, TagInput, TemplatePicker, commands
│   ├── search/     CommandPalette
│   └── ui/         Button, Dialog/Confirm, Menu, Tooltip, Toast, misc
├── features/
│   ├── notes/      DataSource interface, Supabase + local adapters, hooks, import/export
│   ├── search/     ranking (mirror dari SQL)
│   ├── auth/ theme/ categories/
├── pages/          Home, AllNotes, Favorites/Pinned, Drafts, Archive, Category, Note, Editor, Settings, Login
└── lib/            markdown, templates, highlighter, date, uploads, seed
supabase/migrations/0001_init.sql
```
