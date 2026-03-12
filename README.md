# Joshua Jennings — Portfolio

Built with Vite + React + React Router.

## Getting started

```bash
npm install
npm run dev
```

Opens at **http://localhost:5173**

## Pages

- `/` — Home (about, experience, skills, activities)
- `/projects` — Projects with tech tags and GitHub links
- `/photos` — Photo grid

## Adding photos

1. Drop images into `public/photos/` (e.g. `1.jpg`, `2.jpg` …)
2. In `src/pages/Photos.jsx`, replace each placeholder div with:
   ```jsx
   <img src="/photos/1.jpg" alt="description" />
   ```

## Adding your resume

Drop your PDF as `public/resume.pdf` — the resume nav link will work automatically.

## Updating project GitHub links

In `src/pages/Projects.jsx`, each project has a `github` field. Add/update the URLs there.

## Build for production

```bash
npm run build
```
