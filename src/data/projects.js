export const PROJECTS = [
  {
    name: 'iDogtify',
    desc: 'Dog breed classifier that identifies 120 breeds from an uploaded photo or a live camera scan. Fine-tuned a ConvNeXt-Small vision model on the Stanford Dogs dataset to 90.9% top-1 accuracy, served through a FastAPI backend with probability breakdowns for mixed breeds.',
    tech: ['Next.js', 'TypeScript', 'FastAPI', 'PyTorch'],
    period: 'Jun 2026',
    live: 'https://idogtify.vercel.app',
    github: 'https://github.com/sqacetimee/idogtify',
    thumb: '/projects/idogtify.webp',
  },
  {
    name: 'Habiverse',
    desc: 'Interactive dashboard for the NASA Exoplanet Archive. Scores 5,000+ confirmed exoplanets on habitability using six physical factors and a stellar atmosphere retention model, with Earth comparisons, population charts, and a daily data refresh.',
    tech: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Recharts'],
    period: 'Jun 2026',
    live: 'https://habiverse.vercel.app',
    github: 'https://github.com/sqacetimee/habiverse',
    thumb: '/projects/habiverse.webp',
  },
  {
    name: 'Perspective AI (TELUS Hackathon)',
    desc: 'Dual-perspective AI assistant that generates two contrasting viewpoints on any topic in real time. Reduced single-sided response bias by 50%+ in structured prompt testing. Optimized streaming to cut perceived latency by 30%.',
    tech: ['Next.js', 'TypeScript', 'React', 'AI APIs'],
    period: 'Jan 2026',
    live: 'https://prspctvs.xyz/perspective',
    github: 'https://github.com/sqacetimee/perspective',
    thumb: '/projects/perspective.webp',
  },
  {
    name: 'Automated Email Outreach Platform',
    desc: 'Scalable email automation delivering 2,000+ personalized emails per day. Implemented scheduling, batching, and rate-limiting, improving throughput by 300% and reducing send interruptions by 70%.',
    tech: ['JavaScript', 'Node.js', 'Express'],
    period: 'Jan 2024',
    live: null,
    github: null, // NDA
    thumb: null,
  },
  {
    name: 'Real Estate Marketing Website (before vibe coding existed)',
    desc: 'Full-stack marketing site for a NYC brokerage. Conversion-focused UI with responsive layouts, integrated property inquiry workflows, and secure backend lead handling.',
    tech: ['React', 'JavaScript', 'Node.js'],
    period: 'Dec 2023',
    live: 'https://cityemerald.com',
    github: null, // NDA
    thumb: '/projects/cityemerald.webp',
  },
]
