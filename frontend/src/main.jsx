import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Menu principal: controla quais páginas aparecem na barra superior.
// Alterar labels aqui muda o texto dos botões de navegação.
const navigation = [
  { id: 'home', label: 'Início' },
  { id: 'feed', label: 'Feed' },
  { id: 'courses', label: 'Cursos' },
  { id: 'communities', label: 'Comunidades' },
  { id: 'opportunities', label: 'Oportunidades' },
  { id: 'benefits', label: 'Benefícios' },
  { id: 'events', label: 'Eventos' },
  { id: 'rewards', label: 'Pontos' },
  { id: 'partners', label: 'Parceiros' },
  { id: 'profile', label: 'Perfil' },
];
const primaryMobilePageIds = ['feed', 'opportunities', 'benefits', 'events'];
const loggedInPrimaryMobilePageIds = ['feed', 'opportunities', 'benefits', 'events'];
const publicReadPageIds = ['home', 'feed', 'opportunities', 'events', 'benefits', 'profile'];
const subscriptionPendingPageIds = ['profile', 'partners', 'subscription-checkout'];
const guestPrimaryMobilePageIds = ['feed', 'opportunities', 'events', 'benefits'];
const TERMS_VERSION = 'meetpoint-lgpd-2026-06-03';
const PRIVACY_VERSION = 'meetpoint-privacy-lgpd-2026-06-03';
const REQUIRED_CONSENT_TYPE = 'platform_usage';
const TERMS_CONSENT_TEXT =
  'Li e aceito os Termos de Uso e autorizo o tratamento dos meus dados conforme a Política de Privacidade.';

function getPageLabel(pageId) {
  return navigation.find((item) => item.id === pageId)?.label ?? pageId;
}

const mobileNavigationIconNames = {
  home: 'home',
  feed: 'home',
  courses: 'play',
  communities: 'users',
  opportunities: 'briefcase',
  benefits: 'gift',
  events: 'calendar',
  rewards: 'sparkles',
  partners: 'building',
  profile: 'user',
};

const mobileTabLabels = {
  communities: 'Comun.',
  opportunities: 'Oport.',
  benefits: 'Benef.',
};

function getMobileTabLabel(item) {
  return mobileTabLabels[item.id] ?? item.label;
}

function MobileNavIcon({ name }) {
  const paths = {
    building: (
      <>
        <path d="M4 20V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15" />
        <path d="M15 9h4a1 1 0 0 1 1 1v10" />
        <path d="M8 8h3M8 12h3M8 16h3" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v3M17 3v3M4 9h16" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
      </>
    ),
    briefcase: (
      <>
        <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M3 11h18M12 11v2" />
      </>
    ),
    gift: (
      <>
        <path d="M20 12v8H4v-8M2 8h20v4H2zM12 8v12" />
        <path d="M12 8H7.5a2.5 2.5 0 1 1 2.2-3.7L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 8Z" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </>
    ),
    play: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="m10 9 5 3-5 3V9Z" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
        <path d="m5 15 .8 1.7L7.5 18l-1.7.8L5 20.5l-.8-1.7L2.5 18l1.7-.8L5 15ZM19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6L19 14Z" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M18 20a5.6 5.6 0 0 0-2.5-4.7" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        {paths[name] ?? paths.more}
      </g>
    </svg>
  );
}

// Configurações globais usadas pelo frontend para falar com a API e calcular taxas.
const PRODUCTION_API_BASE_URL = 'https://meetpoint-api-y46s.onrender.com';

function resolveApiBaseUrls() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredUrl) return [configuredUrl.replace(/\/+$/, '')];

  if (typeof window === 'undefined') return ['http://127.0.0.1:3000'];

  const { origin, hostname, pathname } = window.location;
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return ['http://127.0.0.1:3000'];
  }

  const candidates = pathname.startsWith('/meetpoint')
    ? [PRODUCTION_API_BASE_URL, `${origin}/api-meetpoint`, `${origin}/meetpoint`, origin]
    : [origin, `${origin}/api-meetpoint`, `${origin}/meetpoint`, PRODUCTION_API_BASE_URL];

  return [...new Set(candidates.map((url) => url.replace(/\/+$/, '')))];
}

const API_BASE_URLS = resolveApiBaseUrls();
const PLATFORM_FEE_PERCENT = 10;
const courseTopicOptions = [
  'Tecnologia',
  'Marketing',
  'Negócios',
  'Comunidade',
  'Conteúdo',
  'Carreira',
  'Finanças',
  'Design',
  'Saúde e bem-estar',
  'Outro tema',
];

function resolveCourseTopic(topic, customTopic = '') {
  if (topic === 'Outro tema') {
    return customTopic.trim() || 'Tema personalizado';
  }
  return topic || 'Conteúdo';
}

function getCourseTopicFilters(courses) {
  const knownTopics = courseTopicOptions.filter((item) => item !== 'Outro tema');
  const courseTopics = courses.map((course) => course.tag).filter(Boolean);
  return ['Todos', 'Gratuitos', 'Pagos', ...new Set([...knownTopics, ...courseTopics])];
}

function getYouTubeVideo(url = '') {
  const rawUrl = String(url).trim();
  if (!rawUrl) return null;

  try {
    const parsedUrl = new URL(rawUrl);
    const host = parsedUrl.hostname
      .replace(/^www\./, '')
      .replace(/^m\./, '')
      .replace(/^music\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] ?? '';
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (parsedUrl.pathname === '/watch') {
        videoId = parsedUrl.searchParams.get('v') ?? '';
      } else {
        const [, pathVideoId] = parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) ?? [];
        videoId = pathVideoId ?? '';
      }
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

    return {
      id: videoId,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

function normalizeYouTubeEmbedUrl(url = '') {
  const video = getYouTubeVideo(url);
  return video?.embedUrl ?? '';
}

function getInlineYouTubeEmbedUrl(video, options = {}) {
  if (!video?.embedUrl) return '';
  const params = new URLSearchParams({
    autoplay: options.autoplay ? '1' : '0',
    mute: options.muted ? '1' : '0',
    controls: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
  });
  if (options.enableJsApi) {
    params.set('enablejsapi', '1');
  }
  if (options.enableJsApi && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    params.set('origin', origin);
  }
  return `${video.embedUrl}?${params.toString()}`;
}

function normalizeExternalUrl(url = '') {
  const value = String(url).trim();
  if (!value) return '';
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsedUrl = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return '';
    return parsedUrl.toString();
  } catch {
    return '';
  }
}

function getExternalCoursePreview(url = '', fallbackTitle = 'Curso externo') {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return null;
  const youtubeVideo = getYouTubeVideo(normalizedUrl);
  const host = new URL(normalizedUrl).hostname.replace(/^www\./, '');
  return {
    url: normalizedUrl,
    host,
    title: youtubeVideo ? 'Vídeo ou curso no YouTube' : fallbackTitle,
    thumbnailUrl: youtubeVideo?.thumbnailUrl ?? '',
    isYoutube: Boolean(youtubeVideo),
  };
}

function createYouTubeMedia(url) {
  const video = getYouTubeVideo(url);
  if (!video) return null;
  return {
    name: 'Vídeo do YouTube',
    type: 'youtube',
    url: video.watchUrl,
    youtubeId: video.id,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnailUrl,
  };
}

const enableDemoContent = false;

// Dados temporários mantidos desligados para a primeira operação real.
const initialCourses = enableDemoContent ? [
  {
    id: 'saas',
    title: 'Arquitetura SaaS Multi-Tenant',
    tag: 'Tecnologia',
    price: 497,
    isFree: false,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    progress: 64,
    level: 'Intermediário',
    instructor: 'Marina Costa',
    company: 'MeetPoint',
    liveDate: '2026-06-04T19:00',
    color: 'pink',
    modules: [
      {
        name: 'Módulo 1',
        lessons: ['Visão geral por tenant', 'RLS no PostgreSQL', 'Prisma seguro'],
      },
      {
        name: 'Módulo 2',
        lessons: ['Videoaula protegida', 'Material PDF', 'Feedback da pessoa'],
      },
    ],
  },
  {
    id: 'community',
    title: 'Comunidades, Conteúdo e Retenção',
    tag: 'Comunidade',
    price: 0,
    isFree: true,
    platformFeePercent: 0,
    progress: 38,
    level: 'Fundamentos',
    instructor: 'Rafael Nunes',
    company: 'MeetPoint Academy',
    liveDate: '2026-06-08T20:00',
    color: 'yellow',
    modules: [
      {
        name: 'Módulo 1',
        lessons: ['Onboarding', 'Engajamento', 'Eventos recorrentes'],
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Entrega de Conteúdo em Escala',
    tag: 'Conteúdo',
    price: 297,
    isFree: false,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    progress: 0,
    level: 'Disponível',
    instructor: 'Ana Lima',
    company: 'MeetPoint',
    liveDate: '2026-06-12T18:30',
    color: 'blue',
    modules: [
      {
        name: 'Módulo 1',
        lessons: ['Link de videoaula no YouTube', 'E-book para download', 'Aula ao vivo'],
      },
    ],
  },
  ] : [];

function normalizeCourseModules(course) {
  return (course?.modules ?? []).map((module, moduleIndex) => ({
    id: module.id ?? `module-${moduleIndex + 1}`,
    title: module.title ?? module.name ?? `Módulo ${moduleIndex + 1}`,
    objective: module.objective ?? 'Objetivo do módulo definido pelo produtor.',
    release: module.release ?? 'Liberação imediata',
    lessons: (module.lessons ?? []).map((lesson, lessonIndex) =>
      typeof lesson === 'string'
        ? {
            id: `lesson-${moduleIndex + 1}-${lessonIndex + 1}`,
            title: lesson,
            type: lesson.toLowerCase().includes('ebook') || lesson.toLowerCase().includes('pdf') ? 'Material' : 'Vídeo',
            duration: '',
            unlockRule: 'Concluir aula',
            material: lesson.toLowerCase().includes('ebook') || lesson.toLowerCase().includes('pdf') ? 'PDF de apoio' : 'Material complementar',
            videoUrl: '',
            attachmentUrl: '',
            assignment: '',
          }
        : {
            videoUrl: '',
            attachmentUrl: '',
            assignment: '',
            ...lesson,
          },
    ),
  }));
}

function getCourseLessonCount(course) {
  return normalizeCourseModules(course).reduce((total, module) => total + module.lessons.length, 0);
}

function parseDurationMinutes(duration = '') {
  const normalized = String(duration).toLowerCase();
  const value = Number(normalized.match(/\d+/)?.[0] ?? 0);
  if (!value) return 0;
  return normalized.includes('h') ? value * 60 : value;
}

function getCourseWorkloadLabel(course) {
  const minutes = normalizeCourseModules(course).reduce(
    (total, module) =>
      total + module.lessons.reduce((lessonTotal, lesson) => lessonTotal + parseDurationMinutes(lesson.duration), 0),
    0,
  );
  if (minutes >= 60) return `${Math.round(minutes / 60)}h de conteúdo`;
  const lessonCount = getCourseLessonCount(course);
  return lessonCount ? `${lessonCount} aulas` : 'Grade em construção';
}

function getCoursePublicationIssues(course, modules) {
  const issues = [];
  const normalizedModules = modules ?? normalizeCourseModules(course);
  const isExternalCourse = course?.deliveryMode === 'external';

  if (!course?.title?.trim() || course.title === 'Novo curso') {
    issues.push({
      id: 'course-title',
      label: 'Nome do curso',
      detail: 'Defina um nome comercial claro para o curso.',
      targetId: 'course-title-field',
    });
  }

  if (!course?.description?.trim()) {
    issues.push({
      id: 'course-description',
      label: 'Descrição do curso',
      detail: 'Explique o que a pessoa vai aprender e o resultado esperado.',
      targetId: 'course-description-field',
    });
  }

  if (!course?.tag?.trim()) {
    issues.push({
      id: 'course-topic',
      label: 'Tema do curso',
      detail: 'Escolha um tema da lista ou digite um tema próprio, como Marketing ou Tecnologia.',
      targetId: 'course-topic-field',
    });
  }

  if (!course?.isFree && Number(course?.price ?? 0) <= 0) {
    issues.push({
      id: 'course-price',
      label: 'Preço do curso',
      detail: 'Cursos pagos precisam ter valor maior que zero.',
      targetId: 'course-price-field',
    });
  }

  if (isExternalCourse && !normalizeExternalUrl(course?.externalCourseUrl)) {
    issues.push({
      id: 'course-external-url',
      label: 'Link externo',
      detail: 'Informe um link válido para a plataforma onde o curso está hospedado.',
      targetId: 'course-external-url-field',
    });
  }

  if (isExternalCourse) return issues;

  if (!normalizedModules.length) {
    issues.push({
      id: 'course-modules',
      label: 'Módulos',
      detail: 'Crie pelo menos um módulo para organizar a entrega.',
      targetId: 'course-module-list',
    });
  }

  normalizedModules.forEach((module, moduleIndex) => {
    const moduleLabel = `Módulo ${moduleIndex + 1}`;
    const moduleTarget = `module-card-${module.id}`;

    if (!module.title?.trim()) {
      issues.push({
        id: `${module.id}-title`,
        label: `${moduleLabel}: título`,
        detail: 'Informe o título do módulo.',
        targetId: moduleTarget,
      });
    }

    if (!module.objective?.trim()) {
      issues.push({
        id: `${module.id}-objective`,
        label: `${moduleLabel}: objetivo`,
        detail: 'Descreva o objetivo do módulo para orientar a pessoa.',
        targetId: moduleTarget,
      });
    }

    if (!module.lessons.length) {
      issues.push({
        id: `${module.id}-lessons`,
        label: `${moduleLabel}: aulas`,
        detail: 'Inclua pelo menos uma aula, live, tarefa ou material.',
        targetId: moduleTarget,
      });
    }

    module.lessons.forEach((lesson, lessonIndex) => {
      const lessonLabel = `${moduleLabel}, aula ${lessonIndex + 1}`;
      const lessonTarget = `lesson-card-${lesson.id}`;
      const lessonType = lesson.type ?? 'Vídeo';

      if (!lesson.title?.trim()) {
        issues.push({
          id: `${lesson.id}-title`,
          label: `${lessonLabel}: título`,
          detail: 'Informe o nome da aula.',
          targetId: lessonTarget,
        });
      }

      if (!lesson.duration?.trim()) {
        issues.push({
          id: `${lesson.id}-duration`,
          label: `${lessonLabel}: duração`,
          detail: 'Informe a duração estimada para cálculo de carga horária.',
          targetId: lessonTarget,
        });
      }

      if (!lesson.unlockRule?.trim()) {
        issues.push({
          id: `${lesson.id}-unlock`,
          label: `${lessonLabel}: avanço`,
          detail: 'Defina a regra que libera a próxima aula.',
          targetId: lessonTarget,
        });
      }

      if (lessonType === 'Vídeo' && !lesson.videoUrl?.trim()) {
        issues.push({
          id: `${lesson.id}-video`,
          label: `${lessonLabel}: vídeo`,
          detail: 'Informe o arquivo ou link do vídeo desta aula.',
          targetId: lessonTarget,
        });
      }

      if (lessonType === 'Material' && !lesson.attachmentUrl?.trim()) {
        issues.push({
          id: `${lesson.id}-material-url`,
          label: `${lessonLabel}: material`,
          detail: 'Inclua o link ou arquivo do material para download.',
          targetId: lessonTarget,
        });
      }

      if (lessonType === 'Tarefa' && !lesson.assignment?.trim()) {
        issues.push({
          id: `${lesson.id}-assignment`,
          label: `${lessonLabel}: tarefa`,
          detail: 'Descreva exatamente o que a pessoa deve entregar.',
          targetId: lessonTarget,
        });
      }
    });
  });

  return issues;
}

function getCommunityAccessMode(community = {}) {
  if (community.accessMode) return community.accessMode;
  return community.privacy === 'Privada' ? 'invite' : 'public';
}

function isCommunityPrivate(community = {}) {
  return getCommunityAccessMode(community) !== 'public';
}

function getCommunityAccessLabel(community = {}) {
  const accessMode = getCommunityAccessMode(community);
  if (accessMode === 'password') return 'Privada com senha';
  if (accessMode === 'invite') return 'Privada por convite';
  return 'Pública';
}

function CommunityAvatar({ community, className = '' }) {
  const initials = getInitials(community?.name ?? 'Comunidade');
  return (
    <span className={`community-avatar ${community?.photo ? 'has-photo' : ''} ${className}`.trim()}>
      {community?.photo ? <img src={community.photo} alt="" /> : <b className="community-avatar-initials">{initials}</b>}
    </span>
  );
}

const initialCommunities = enableDemoContent ? [
  {
    id: 'growth',
    name: 'Growth para EAD',
    topic: 'Aquisição e retenção',
    type: 'Marketing',
    members: 184,
    unread: 12,
    privacy: 'Público',
    accessMode: 'public',
    joined: true,
    isAdmin: true,
    favorite: true,
    color: 'pink',
  },
  {
    id: 'product',
    name: 'Produto Digital',
    topic: 'Oferta, conteúdo e precificação',
    type: 'Produto',
    members: 97,
    unread: 4,
    privacy: 'Público',
    accessMode: 'public',
    joined: true,
    isAdmin: false,
    favorite: false,
    color: 'yellow',
  },
  {
    id: 'tech',
    name: 'Arquitetura SaaS',
    topic: 'Node.js, NestJS e PostgreSQL',
    type: 'Tecnologia',
    members: 63,
    unread: 0,
    privacy: 'Público',
    accessMode: 'public',
    joined: true,
    isAdmin: true,
    favorite: false,
    color: 'blue',
  },
  ] : [];

const messages = enableDemoContent ? [
  {
    id: 'community-message-1',
    author: 'Marina Costa',
    role: 'Admin',
  time: '09:14',
createdAt: Date.now() - 1000 * 60 * 8,
    body: 'A comunidade aceita vídeos, imagens e arquivos, mas a moderação bloqueia conteúdo sexual, violento ou sensível.',
    edited: false,
    deleted: false,
    deletedByAdmin: false,
  },
  {
    id: 'community-message-2',
    author: 'Rafael Nunes',
    role: 'Membro',
    time: '09:14',
createdAt: Date.now() - 1000 * 60 * 8,
    body: 'Vou participar do networking se a call for depois das 19h.',
    edited: false,
    deleted: false,
    deletedByAdmin: false,
  },
  {
    id: 'community-message-3',
    author: 'Você',
    role: 'Admin',
    time: '09:14',
createdAt: Date.now() - 1000 * 60 * 8,
    body: 'Fechado. Vamos abrir votação e mandar o link de calendário para todos.',
    mine: true,
    edited: false,
    deleted: false,
    deletedByAdmin: false,
  },
  ] : [];

const scheduledEvents = enableDemoContent ? [
  {
    title: 'Aula ao vivo: RLS e Prisma',
    type: 'Aula ao vivo',
    mode: 'Online',
    owner: 'Marina Costa',
    date: '2026-06-04',
    time: '19:00',
    location: 'Sala ao vivo MeetPoint',
    description: 'Aula prática sobre isolamento de dados, tenant e Prisma.',
    price: 0,
    capacity: 80,
    participants: ['Lucas Carvalho', 'Marina Costa'],
    yes: 42,
    no: 6,
  },
  {
    title: 'Networking Growth para EAD',
    type: 'Networking',
    mode: 'Presencial',
    owner: 'Comunidade Growth',
    date: '2026-06-08',
    time: '20:00',
    location: 'Hub Londrina Centro',
    description: 'Rodada de conexão para produtores, professores e empresas locais.',
    price: 49,
    capacity: 40,
    participants: ['Rafael Nunes', 'Agência Norte'],
    yes: 31,
    no: 3,
  },
  {
    title: 'Mentoria de Produto Digital',
    type: 'Mentoria',
    mode: 'Online',
    owner: 'Rafael Nunes',
    date: '2026-06-12',
    time: '18:30',
    location: 'Videochamada exclusiva',
    description: 'Mentoria paga para revisar oferta, promessa, módulos e retenção.',
    price: 97,
    capacity: 25,
    participants: ['Rafael Nunes'],
    yes: 18,
    no: 2,
  },
  ] : [];

// Posts iniciais desligados: producao deve vir da API/banco.
const initialFeedPosts = enableDemoContent ? [
  {
    id: 'post-1',
    author: 'MeetPoint Oficial',
    authorHandle: '@meetpoint',
    role: 'Patrocinador',
    initials: 'MP',
    city: 'Londrina',
    tag: 'Aviso oficial',
    body: 'Semana de networking local com vagas, cupons de parceiros e live exclusiva para assinantes. #networking #eventos',
    likes: 128,
    reactionSummary: { like: 84, love: 31, fire: 13 },
    reactors: [
      { user: 'Lucas Carvalho', reaction: 'love', at: '29/05/2026 09:10' },
      { user: 'Agência Norte', reaction: 'fire', at: '29/05/2026 09:16' },
    ],
    comments: [
      { id: 'comment-1', author: 'Lucas Carvalho', body: 'Vou participar da live exclusiva.' },
      { id: 'comment-2', author: 'Agência Norte', body: 'Podemos divulgar vagas nessa semana também?' },
    ],
    mediaType: 'image',
  },
  {
    id: 'post-2',
    author: 'Dra. Camila Torres',
    authorHandle: '@camilatorres',
    role: 'Conteúdo de autoridade',
    initials: 'CT',
    city: 'Maringá',
    tag: 'Saúde e carreira',
    body: 'Abrimos uma trilha curta sobre produtividade, saúde mental e rotina para profissionais autônomos. #saude #carreira',
    likes: 86,
    reactionSummary: { like: 42, love: 36, fire: 8 },
    reactors: [
      { user: 'Marina Costa', reaction: 'love', at: '29/05/2026 10:02' },
      { user: 'Rafael Nunes', reaction: 'like', at: '29/05/2026 10:05' },
    ],
    comments: [
      { id: 'comment-3', author: 'Marina Costa', body: 'Conteúdo perfeito para os grupos de mentoria.' },
    ],
    mediaType: 'youtube',
    mediaName: 'Vídeo no YouTube',
    mediaUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    youtubeId: 'ysz5S6PUM-U',
  },
  {
    id: 'post-3',
    author: 'Associação Empresarial',
    authorHandle: '@associacaoempresarial',
    role: 'Comunidade PJ',
    initials: 'AE',
    city: 'Apucarana',
    tag: 'Negócios locais',
    body: 'Empresas parceiras podem publicar vagas, benefícios e eventos diretamente dentro da plataforma. #vagas #negocioslocais',
    likes: 61,
    reactionSummary: { like: 39, love: 11, fire: 11 },
    reactors: [
      { user: 'MeetPoint', reaction: 'like', at: '29/05/2026 11:22' },
    ],
    comments: [],
    mediaType: '',
  },
  ] : [];

// Estrutura social demo desligada: conexoes reais devem vir do backend.
const socialProfiles = enableDemoContent ? [
  {
    id: 'person-marina',
    name: 'Marina Costa',
    handle: '@marinacosta',
    initials: 'MC',
    city: 'Londrina',
    bio: 'Arquiteta SaaS e professora de tecnologia.',
    interests: ['Tecnologia', 'Cursos', 'Comunidade'],
    followers: 1840,
    posts: 42,
  },
  {
    id: 'person-camila',
    name: 'Dra. Camila Torres',
    handle: '@camilatorres',
    initials: 'CT',
    city: 'Maringá',
    bio: 'Conteúdo de autoridade sobre saúde, carreira e produtividade.',
    interests: ['Saúde e carreira', 'Eventos'],
    followers: 3120,
    posts: 87,
  },
  {
    id: 'person-rafael',
    name: 'Rafael Nunes',
    handle: '@rafaelnunes',
    initials: 'RN',
    city: 'Apucarana',
    bio: 'Produto digital, comunidades e retenção.',
    interests: ['Comunidade', 'Negócios locais'],
    followers: 960,
    posts: 31,
  },
  {
    id: 'person-meetpoint',
    name: 'MeetPoint Oficial',
    handle: '@meetpoint',
    initials: 'MP',
    city: 'Regional',
    bio: 'Novidades oficiais, parceiros, eventos e benefícios da plataforma.',
    interests: ['Aviso oficial', 'Benefícios', 'Eventos'],
    followers: 7280,
    posts: 128,
  },
  {
    id: 'person-associacao',
    name: 'Associação Empresarial',
    handle: '@associacaoempresarial',
    initials: 'AE',
    city: 'Apucarana',
    bio: 'Empresas, vagas, eventos e networking local.',
    interests: ['Negócios locais', 'Vagas'],
    followers: 1490,
    posts: 55,
  },
  ] : [];

const initialPrivateConversations = socialProfiles.slice(0, 4).map((profile, index) => ({
  id: `conversation-${profile.id}`,
  participantId: profile.id,
  participantName: profile.name,
  participantHandle: profile.handle,
  participantInitials: profile.initials,
  participantPhoto: profile.photo,
  unread: index === 0 ? 1 : 0,
  messages: index === 0
    ? [
        {
          id: 'private-seed-1',
          from: profile.name,
          body: 'Oi, vi seu comentário no feed. Vamos conectar?',
          time: '10:20',
          mine: false,
        },
      ]
    : [
        {
          id: `private-seed-${index + 1}`,
          from: profile.name,
          body: index === 1 ? 'Posso te mandar uma referência depois.' : 'Vamos falar por aqui.',
          time: `0${9 + index}:15`,
          mine: false,
        },
      ],
}));

// Oportunidades: canais escolhidos por quem publica. O card renderiza somente estes canais.
const opportunityContactMethods = [
  {
    id: 'application',
    label: 'Candidatura',
    shortLabel: 'Candidatar-se',
    icon: '✓',
    description: 'Receber currículo pela plataforma.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    icon: '☏',
    description: 'Abrir contato direto pelo WhatsApp.',
  },
  {
    id: 'email',
    label: 'Email',
    shortLabel: 'Email',
    icon: '✉',
    description: 'Receber contato no email informado.',
  },
  {
    id: 'platform',
    label: 'Mensagem interna',
    shortLabel: 'Mensagem',
    icon: '●',
    description: 'Conversar dentro da plataforma.',
  },
];

function getOpportunityCategoryFromType(type) {
  if (type === 'Espaço') return 'Locação de espaço';
  if (type === 'Parceria') return 'Parceria comercial';
  if (type === 'Serviço') return 'Divulgação de serviço';
  return 'Profissional';
}

function isProfessionalOpportunity(job = {}) {
  return job.category === 'Profissional' || ['CLT', 'Freela', 'Estágio'].includes(job.type);
}

function getDefaultOpportunityContactMethods(job = {}) {
  return isProfessionalOpportunity(job) ? ['application', 'email'] : ['whatsapp', 'email', 'platform'];
}

function normalizeOpportunityContactMethods(job = {}) {
  const validIds = new Set(opportunityContactMethods.map((method) => method.id));
  const explicitMethods = Array.isArray(job.contactMethods)
    ? job.contactMethods.filter((method) => validIds.has(method))
    : [];
  return explicitMethods.length > 0 ? explicitMethods : getDefaultOpportunityContactMethods(job);
}

function hasOpportunityContactMethod(job, method) {
  return normalizeOpportunityContactMethods(job).includes(method);
}

function cleanMailHeader(value = '') {
  return String(value).replace(/[\r\n]/g, ' ').trim();
}

function buildOpportunityEmailAction(job = {}, currentUser, resumeName = '') {
  const recipient = cleanMailHeader(job.rhEmail || '');
  const candidateName = cleanMailHeader(currentUser?.name || 'Candidato');
  const candidateEmail = cleanMailHeader(getContactEmail(currentUser));
  const company = cleanMailHeader(job.company || 'equipe responsável');
  const title = cleanMailHeader(job.title || 'oportunidade');
  const resumeLabel = cleanMailHeader(resumeName || 'currículo do perfil ainda não cadastrado');
  const subject = `Interesse em ${title} - ${candidateName}`;
  const body = [
    `Olá, ${company}.`,
    '',
    `Tenho interesse na oportunidade "${title}".`,
    `Nome: ${candidateName}`,
    candidateEmail ? `Email para retorno: ${candidateEmail}` : '',
    `Currículo informado: ${resumeLabel}`,
    '',
    'Observação: por segurança do navegador, o arquivo do currículo não é anexado automaticamente pelo site. Anexe o arquivo antes de enviar ou use a candidatura pela plataforma.',
    '',
    'Mensagem:',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    recipient,
    subject,
    body,
    href: recipient
      ? `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : '',
  };
}

// Vagas iniciais desligadas: oportunidades reais devem ser criadas pelos usuários.
const initialJobs = enableDemoContent ? [
  {
    id: 'job-1',
    title: 'Analista de Marketing Digital',
    company: 'Agência Norte',
    city: 'Londrina',
    type: 'CLT',
    category: 'Profissional',
    salary: 'R$ 3.800',
    skills: ['Meta Ads', 'Copywriting', 'Analytics'],
    description: 'Atuação em campanhas locais, calendário de conteúdo e análise de performance.',
    requirements: 'Experiência com tráfego pago, relatórios e comunicação com clientes.',
    benefits: 'Vale alimentação, bônus por performance e trilhas de capacitação.',
    rhEmail: 'rh@agencianorte.com',
    whatsapp: '+55 43 99999-1001',
    contactMethods: ['application', 'email'],
    applicants: 18,
  },
  {
    id: 'job-2',
    title: 'Desenvolvedor Frontend',
    company: 'MeetPoint',
    city: 'Remoto',
    type: 'Freela',
    category: 'Profissional',
    salary: 'R$ 6.000',
    skills: ['React', 'TypeScript', 'UI'],
    description: 'Projeto de frontend para marketplace regional, comunidades e área de conteúdo.',
    requirements: 'Portfólio com React, consumo de API e atenção forte a layout responsivo.',
    benefits: 'Contrato remoto, entregas por sprint e possibilidade de recorrência.',
    rhEmail: 'rh@meetpoint.com',
    whatsapp: '+55 11 99999-2020',
    contactMethods: ['application', 'email'],
    applicants: 9,
  },
  {
    id: 'job-3',
    title: 'Estágio em Atendimento',
    company: 'Clube de Benefícios',
    city: 'Maringá',
    type: 'Estágio',
    category: 'Profissional',
    salary: 'R$ 1.400',
    skills: ['Comunicação', 'CRM', 'Organização'],
    description: 'Atendimento a parceiros, atualização de cadastros e apoio ao clube de benefícios.',
    requirements: 'Boa escrita, organização e disponibilidade para rotina híbrida.',
    benefits: 'Bolsa estágio, mentoria interna e acesso aos cursos da plataforma.',
    rhEmail: 'rh@clubedebeneficios.com',
    whatsapp: '+55 44 99999-3030',
    contactMethods: ['application', 'email'],
    applicants: 27,
  },
  {
    id: 'job-4',
    title: 'Auditório para eventos corporativos',
    company: 'Hub Londrina Centro',
    city: 'Londrina',
    type: 'Espaço',
    category: 'Locação de espaço',
    salary: 'A partir de R$ 690/dia',
    skills: ['80 lugares', 'Projetor', 'Café incluso'],
    description: 'Espaço presencial para aulas, networking, treinamentos e eventos de parceiros.',
    requirements: 'Reserva mínima de 4 horas, confirmação de data e contrato simples.',
    benefits: 'Recepção, internet, café e suporte no dia do evento.',
    rhEmail: 'eventos@hublondrina.com',
    whatsapp: '+55 43 99999-4040',
    contactMethods: ['whatsapp', 'email'],
    applicants: 6,
  },
  {
    id: 'job-5',
    title: 'Parceria para clube de vantagens',
    company: 'Restaurante Central',
    city: 'Londrina',
    type: 'Parceria',
    category: 'Parceria comercial',
    salary: 'Comissão por resgate',
    skills: ['Cupom', 'Assinantes', 'Visibilidade local'],
    description: 'Busca parceiros para campanhas com cupons e benefícios para assinantes.',
    requirements: 'Empresa ativa, oferta clara e aceite de acompanhamento de resgates.',
    benefits: 'Destaque no app, tráfego local e relatórios de interesse.',
    rhEmail: 'parcerias@restaurantecentral.com',
    whatsapp: '+55 43 99999-5050',
    contactMethods: ['whatsapp', 'email', 'platform'],
    applicants: 11,
  },
  ] : [];

const initialBenefits = enableDemoContent ? [
  {
    id: 'benefit-1',
    title: '20% OFF no combo executivo',
    partner: 'Restaurante Central',
    category: 'Alimentação',
    city: 'Londrina',
    pointsCost: 120,
    redemptions: 44,
    emailSubject: 'Seu cupom do Restaurante Central',
    emailBody: 'Apresente o cupom no caixa para aplicar 20% de desconto no combo executivo.',
    deliveryAssetName: 'cupom-restaurante-central.pdf',
    deliveryCode: 'MP-REST20',
    createdBy: 'Admin MeetPoint',
    createdAt: '2026-05-20T10:00:00',
  },
  {
    id: 'benefit-2',
    title: 'Barba + cabelo com desconto',
    partner: 'Barbearia Prime',
    category: 'Serviços',
    city: 'Maringá',
    pointsCost: 90,
    redemptions: 31,
    emailSubject: 'Seu voucher da Barbearia Prime',
    emailBody: 'Use este voucher para validar o desconto direto na unidade parceira.',
    deliveryAssetName: 'voucher-barbearia-prime.pdf',
    deliveryCode: 'MP-BARBA90',
    createdBy: 'Admin MeetPoint',
    createdAt: '2026-05-21T09:30:00',
  },
  {
    id: 'benefit-3',
    title: 'Ingresso VIP para networking',
    partner: 'MeetPoint',
    category: 'Eventos',
    city: 'Regional',
    pointsCost: 240,
    redemptions: 16,
    emailSubject: 'Seu ingresso VIP MeetPoint',
    emailBody: 'O ingresso digital foi anexado. Leve o código de validação no dia do evento.',
    deliveryAssetName: 'ingresso-vip-networking.pdf',
    deliveryCode: 'MP-VIP240',
    createdBy: 'Admin MeetPoint',
    createdAt: '2026-05-22T14:00:00',
  },
  ] : [];

const rewardActions = [
  { action: 'Entrar diariamente', points: 5 },
  { action: 'Publicar no feed', points: 15 },
  { action: 'Comentar em comunidade', points: 8 },
  { action: 'Participar de evento', points: 30 },
  { action: 'Concluir aula', points: 20 },
  { action: 'Resgatar benefício', points: 10 },
];

const benefitRequestStorageKey = 'meetPointBenefitRequests';

// Planos comerciais da área Parceiros. Alterar aqui muda cards e checkout de assinatura.
const partnerPlans = [
  {
    id: 'pf',
    subscriptionPlanId: '00000000-0000-4000-8000-000000000049',
    name: 'PF Assinante',
    price: 49.9,
    description: 'Acesso a comunidades, eventos, benefícios, feed e conteúdos selecionados.',
  },
  {
    id: 'pj',
    subscriptionPlanId: '00000000-0000-4000-8000-000000000099',
    name: 'PJ Parceiro',
    price: 99.9,
    description: 'Publicação de vagas, benefícios, conteúdos, cursos e presença em comunidades.',
  },
  {
    id: 'sponsor',
    subscriptionPlanId: '00000000-0000-4000-8000-000000000490',
    name: 'Patrocinador',
    price: 490,
    description: 'Banners, destaques na home, presença institucional e espaco premium regional.',
  },
  {
    id: 'ambassador',
    subscriptionPlanId: '00000000-0000-4000-8000-000000000000',
    name: 'Embaixador',
    price: 0,
    description: 'Link próprio, benefícios VIP e comissão por indicação validada.',
  },
];

const partnerPlanDetails = {
  pf: {
    label: 'Para pessoa física',
    badge: 'Mais acessivel',
    audience: 'Usuários que querem benefícios, comunidades, eventos e conteúdos.',
    bullets: ['Clube de benefícios liberado', 'Comunidades e eventos exclusivos', 'Pontos e recompensas'],
  },
  pj: {
    label: 'Para empresa parceira',
    badge: 'Recomendado',
    audience: 'Empresas que querem recrutar, vender, divulgar e operar relacionamento regional.',
    bullets: ['Publicar vagas e benefícios', 'Criar conteúdos e treinamentos', 'Perfil empresarial completo'],
  },
  sponsor: {
    label: 'Para marcas premium',
    badge: 'Maior visibilidade',
    audience: 'Patrocinadores que querem presença institucional e destaque comercial.',
    bullets: ['Banner em destaque', 'Presença em home e campanhas', 'Espaço premium regional'],
  },
  ambassador: {
    label: 'Para afiliados',
    badge: 'Comissão',
    audience: 'Pessoas que divulgam a plataforma e recebem por conversão validada.',
    bullets: ['Link próprio de indicação', 'Comissão por conversão', 'Acesso VIP para divulgação'],
  },
};

const bannedTerms = ['sexual', 'violento', 'violência', 'nudez'];
const defaultNiches = ['Todas', 'Marketing', 'Produto', 'Tecnologia', 'Educação'];

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function calculatePlatformSplit(price) {
  const gross = Number(price || 0);
  const platformFee = Math.round(gross * PLATFORM_FEE_PERCENT) / 100;
  return {
    gross,
    platformFee,
    producerNet: gross - platformFee,
  };
}

async function apiRequest(path, options = {}) {
  const { token, headers, ...requestOptions } = options;
  const requestConfig = {
    ...requestOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  };
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    const targetUrl = `${baseUrl}${path}`;
    try {
      const response = await fetch(targetUrl, requestConfig);
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || `Erro HTTP ${response.status}`);
        error.status = response.status;
        error.url = targetUrl;
        if ([404, 405].includes(response.status) && API_BASE_URLS.length > 1) {
          lastError = error;
          continue;
        }
        throw error;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const error = new Error('A rota de API retornou uma resposta invalida.');
        error.status = 404;
        error.url = targetUrl;
        if (API_BASE_URLS.length > 1) {
          lastError = error;
          continue;
        }
        throw error;
      }
      return response.json();
    } catch (error) {
      error.url = error.url ?? targetUrl;
      lastError = error;
      if (error.status && ![404, 405].includes(error.status)) break;
      if (API_BASE_URLS.length <= 1) break;
    }
  }

  throw lastError ?? new Error('Nao foi possivel conectar a API.');
}

function loginRequest(email, password, consent = {}) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      termsAccepted: Boolean(consent.termsAccepted),
      termsVersion: consent.termsVersion ?? TERMS_VERSION,
      privacyVersion: consent.privacyVersion ?? PRIVACY_VERSION,
      consentType: consent.consentType ?? REQUIRED_CONSENT_TYPE,
    }),
  });
}

function registerRequest(payload = {}) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function authenticatedUserRequest(token) {
  return apiRequest('/auth/me', { token });
}

function privacyConsentRequest(consent = {}) {
  return apiRequest('/auth/privacy-consent', {
    method: 'POST',
    body: JSON.stringify({
      termsVersion: consent.termsVersion ?? TERMS_VERSION,
      privacyVersion: consent.privacyVersion ?? PRIVACY_VERSION,
      consentType: consent.consentType ?? REQUIRED_CONSENT_TYPE,
      accepted: true,
      country: consent.country ?? '',
    }),
  });
}

function subscriptionRequest(path, options = {}) {
  return apiRequest(`/subscriptions${path}`, options);
}

function platformAdminRequest(path, token, options = {}) {
  return apiRequest(`/platform-admin${path}`, { ...options, token });
}

function supportRequest(path, options = {}) {
  return apiRequest(`/support${path}`, options);
}

const LAST_SIGNUP_LOGIN_KEY = 'lastMeetPointLoginEmail';
const LAST_SIGNUP_REQUIRES_SUBSCRIPTION_KEY = 'lastMeetPointRequiresSubscription';
const LAST_SIGNUP_SEGMENT_KEY = 'lastMeetPointSignupSegment';
const ROUTE_LOCK_KEY = 'meetPointRouteLock';
const DOCUMENT_VALIDATION_ENDPOINT = import.meta.env?.VITE_DOCUMENT_VALIDATION_ENDPOINT || '';

function mapBackendUserToAccount(user = {}, extra = {}) {
  const email = user.email ?? '';
  const name = user.name ?? email.split('@')[0] ?? 'Conta MeetPoint';
  const pendingSignupEmail =
    typeof localStorage === 'undefined' ? '' : localStorage.getItem(LAST_SIGNUP_LOGIN_KEY);
  const pendingSignupSegment =
    typeof localStorage === 'undefined' ? '' : localStorage.getItem(LAST_SIGNUP_SEGMENT_KEY);
  const segment = user.platformRole
    ? 'platform'
    : user.role === 'ADMIN'
      ? 'platform'
      : pendingSignupEmail === email.toLowerCase() && pendingSignupSegment
        ? pendingSignupSegment
      : 'student';

  return {
    id: user.sub ?? user.id ?? email,
    name,
    initials: getInitials(name),
    email,
    contactEmail: user.contactEmail ?? email,
    segment,
    label: getAccountTypeLabel(segment),
    tenantId: user.tenantId,
    city: user.city ?? '',
    state: user.state ?? '',
    bio: user.bio ?? '',
    profilePhoto: user.profileImage ?? '',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    platformRole: user.platformRole,
    accountStatus: user.status,
    subscriptionActive: user.subscription?.status === 'ACTIVE',
    subscription: user.subscription ?? null,
    backendUser: user,
    ...extra,
  };
}

function getLastSignupLoginEmail() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LAST_SIGNUP_LOGIN_KEY) || '';
}

function createTermsConsentRecord(userId) {
  return {
    userId,
    termsVersion: TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ip: '',
  };
}

function createPrivacyConsentRecord(userId, consentType = REQUIRED_CONSENT_TYPE) {
  const now = new Date().toISOString();
  return {
    userId,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    consentType,
    accepted: true,
    acceptedAt: now,
    createdAt: now,
    updatedAt: now,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ipAddress: '',
    country: '',
  };
}

function hasValidPrivacyConsent(user) {
  const consent = user?.privacyConsent;
  return Boolean(
    consent?.accepted
    && consent.termsVersion === TERMS_VERSION
    && consent.privacyVersion === PRIVACY_VERSION
    && consent.consentType === REQUIRED_CONSENT_TYPE,
  );
}

function createPendingSubscriptionRecord(planId = '') {
  const now = new Date().toISOString();
  return {
    status: 'PENDING_PAYMENT',
    planId,
    paymentProvider: '',
    externalSubscriptionId: '',
    createdAt: now,
    updatedAt: now,
  };
}

function hasActivePlatformSubscription(user) {
  if (!user) return false;
  if (user.segment === 'platform' || user.platformRole) return true;
  if (user.subscriptionActive) return true;
  const subscription = user.subscription;
  if (subscription?.status !== 'ACTIVE') return false;
  if (!subscription.expiresAt) return true;
  return new Date(subscription.expiresAt).getTime() > Date.now();
}

function isValidEmailFormat(value = '') {
  const email = value.trim().toLowerCase();
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidRealContactEmail(value = '') {
  const email = value.trim().toLowerCase();
  if (!isValidEmailFormat(email)) return false;
  const [, domain = ''] = email.split('@');
  const blockedDomains = new Set([
    'meetpoint.com',
    'example.com',
    'example.com.br',
    'teste.com',
    'test.com',
    'fake.com',
    'dominio.com',
    'email.com',
  ]);
  if (blockedDomains.has(domain)) return false;
  if (domain.endsWith('.invalid') || domain.endsWith('.test') || domain === 'localhost') return false;
  return true;
}

function getContactEmail(account) {
  return account?.contactEmail || account?.signupRecord?.contactEmail || account?.email || '';
}

const initialUserNotifications = enableDemoContent ? [
  { id: 'notice-1', title: 'Novo comentário no seu post', channel: 'computador', read: false },
  { id: 'notice-2', title: 'Sua candidatura foi visualizada', channel: 'celular', read: false },
  {
    id: 'notice-social-follow-1',
    title: 'Dra. Camila Torres começou a seguir você.',
    channel: 'computador',
    read: false,
    type: 'social-follow',
    actorHandle: '@camilatorres',
  },
  {
    id: 'notice-social-request-1',
    title: 'Rafael Nunes enviou uma solicitação de amizade.',
    channel: 'computador',
    read: false,
    type: 'friend-request',
    actorHandle: '@rafaelnunes',
  },
  ] : [];

const initialNotificationPrefs = { celular: true, computador: true, email: true };
const feedInteractionWeights = {
  view: 1,
  reaction: 8,
  comment: 10,
  share: 12,
  publish: 6,
};

const defaultVisualPreferences = {
  mode: 'light',
  primary: '#111318',
  secondary: '#f2c94c',
  button: '#111318',
  highlight: '#d6a916',
  text: '#111318',
  imageFilter: 'none',
  imageDim: 18,
  imageBrightness: 92,
};

const defaultResumeDetails = {
  mode: 'empty',
  fileName: '',
  objective: '',
  experience: '',
  education: '',
  skills: '',
  portfolio: '',
};

function createDefaultVisualPreferences() {
  return { ...defaultVisualPreferences };
}

function normalizeVisualPreferences(value = {}) {
  return {
    ...createDefaultVisualPreferences(),
    ...(value && typeof value === 'object' ? value : {}),
  };
}

function getVisualPreferencesStorageKey(account) {
  return `meetpoint:visual:${getAccountSessionKey(account) || 'guest'}`;
}

function getWorkspaceStorageKey(account) {
  const sessionKey = getAccountSessionKey(account);
  return sessionKey ? `meetpoint:workspace:${sessionKey}` : '';
}

function readStoredVisualPreferences(account) {
  try {
    const saved = localStorage.getItem(getVisualPreferencesStorageKey(account));
    return normalizeVisualPreferences(saved ? JSON.parse(saved) : {});
  } catch {
    return createDefaultVisualPreferences();
  }
}

function normalizeProfilePublicInfo(account, profileInfo = {}) {
  const coverPhoto =
    profileInfo.coverPhoto ||
    profileInfo.coverImage ||
    profileInfo.coverUrl ||
    profileInfo.bannerImage ||
    profileInfo.bannerUrl ||
    '';
  return resolveProfileInfo(account, {
    ...profileInfo,
    coverPhoto,
  });
}

function normalizeWorkspaceSnapshot(snapshot, account) {
  const defaults = account ? createAccountWorkspace(account) : createGuestWorkspace();
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const socialGraph = {
    ...defaults.socialGraph,
    ...(source.socialGraph ?? {}),
  };
  const hasLegacyDemoStats =
    source.userPoints === 420 ||
    socialGraph.friendHandles.length === 1 ||
    socialGraph.followerHandles.length === 3 ||
    socialGraph.followingHandles.length === 2;
  return {
    ...defaults,
    ...source,
    userPoints: hasLegacyDemoStats ? defaults.userPoints : source.userPoints ?? defaults.userPoints,
    notifications: hasLegacyDemoStats ? defaults.notifications : source.notifications ?? defaults.notifications,
    socialGraph: hasLegacyDemoStats ? defaults.socialGraph : socialGraph,
    profilePublicInfo: normalizeProfilePublicInfo(
      account,
      source.profilePublicInfo ?? defaults.profilePublicInfo,
    ),
    visualPreferences: normalizeVisualPreferences(source.visualPreferences ?? defaults.visualPreferences),
  };
}

function readStoredWorkspace(account) {
  const storageKey = getWorkspaceStorageKey(account);
  if (!storageKey || typeof localStorage === 'undefined') return null;
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? normalizeWorkspaceSnapshot(JSON.parse(saved), account) : null;
  } catch {
    return null;
  }
}

function writeStoredWorkspace(account, snapshot) {
  const storageKey = getWorkspaceStorageKey(account);
  if (!storageKey || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeWorkspaceSnapshot(snapshot, account)));
  } catch {
    // Sem armazenamento local, o workspace continua apenas na sessao atual.
  }
}

function createDefaultResumeDetails() {
  return { ...defaultResumeDetails };
}

const ownSocialBaseStats = {
  friends: 0,
  followers: 0,
  following: 0,
};

function createDefaultSocialGraph() {
  return {
    followingHandles: [],
    sentFriendRequestHandles: [],
    incomingFriendRequestHandles: [],
    friendHandles: [],
    followerHandles: [],
    blockedHandles: [],
    followerDeltas: {},
  };
}

function uniqueItems(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function getSocialProfileByHandle(handle) {
  return socialProfiles.find((profile) => profile.handle === handle);
}

function normalizeInterestTerm(term = '') {
  return term
    .toString()
    .replace(/[#.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPostInterestSignals(post = {}) {
  const authorProfile = getSocialProfileByName(post.author);
  const rawSignals = [
    post.tag,
    ...(authorProfile?.interests ?? []),
  ];
  const text = `${post.tag ?? ''} ${post.body ?? ''}`.toLowerCase();
  if (/curso|aula|trilha|mentoria|conteudo|conteúdo/.test(text)) rawSignals.push('Cursos');
  if (/evento|live|networking|agenda|encontro/.test(text)) rawSignals.push('Eventos');
  if (/vaga|emprego|freela|curriculo|currículo|oportunidade/.test(text)) rawSignals.push('Vagas');
  if (/cupom|beneficio|benefício|desconto|parceiro/.test(text)) rawSignals.push('Benefícios');
  if (/comunidade|grupo|membro/.test(text)) rawSignals.push('Comunidade');

  return uniqueItems(rawSignals.map(normalizeInterestTerm).filter(Boolean));
}

function getPostInterestScore(post, interestScores = {}) {
  return getPostInterestSignals(post).reduce(
    (total, signal) => total + (interestScores[signal] ?? 0),
    0,
  );
}

function getTopInterestSignals(interestScores = {}, limit = 4) {
  return Object.entries(interestScores)
    .filter(([, score]) => score > 0)
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([signal, score]) => ({ signal, score }));
}

function extractHashtags(text = '') {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return uniqueItems(matches.map((tag) => tag.toLowerCase()));
}

function formatHashtagUsage(count = 0) {
  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)} mi`;
  }
  if (count >= 1_000) {
    return `${Math.round(count / 1_000)} mil`;
  }
  return `${count}`;
}

function buildHashtagStats(posts = []) {
  const counts = {};
  posts.forEach((post) => {
    extractHashtags(`${post.body ?? ''} ${post.tag ?? ''}`).forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
    });
  });

  return Object.entries(counts)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

function getFallbackSocialProfile(handle) {
  const label = String(handle ?? '@perfil').replace('@', '').replace(/[._-]+/g, ' ');
  const name = label
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Perfil';

  return {
    id: `profile-${handle}`,
    name,
    handle,
    initials: getInitials(name),
    city: 'Regional',
    bio: 'Perfil da rede MeetPoint.',
    interests: ['Comunidade'],
    followers: 0,
    posts: 0,
  };
}

function getConnectionProfiles(handles = []) {
  return uniqueItems(handles).map((handle) => getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle));
}

function getCurrentUserSocialProfile(currentUser, profilePublicInfo, profilePhoto) {
  const displayName = profilePublicInfo?.displayName || currentUser?.name || 'Você';
  return {
    id: 'current-user-profile',
    name: displayName,
    handle: getUserHandle(currentUser),
    initials: currentUser?.initials ?? getInitials(displayName),
    city: profilePublicInfo?.city || 'Regional',
    bio: profilePublicInfo?.bio || '',
    photo: profilePhoto,
    interests: currentUser?.interests ?? [],
    followers: ownSocialBaseStats.followers,
    posts: 0,
  };
}

function getProfileSampleHandles(profile, offset = 0, limit = 3) {
  const handles = socialProfiles
    .filter((item) => item.handle !== profile?.handle)
    .map((item) => item.handle);
  return handles.slice(offset, offset + limit);
}

function getPostAuthorHandle(post) {
  if (post?.authorHandle) return post.authorHandle;
  const profile = getSocialProfileByName(post?.author);
  return profile?.handle ?? getUserHandle({ name: post?.author });
}

function getProfilePosts(profile, posts = []) {
  if (!profile) return [];
  const profileName = profile.name?.toLowerCase?.() ?? '';
  return posts.filter((post) => (
    getPostAuthorHandle(post) === profile.handle ||
    post.author?.toLowerCase?.() === profileName
  ));
}

function getOwnProfilePosts(currentUser, posts = []) {
  if (!currentUser) return [];
  const handle = getUserHandle(currentUser);
  const name = currentUser.name?.toLowerCase?.() ?? '';
  const email = currentUser.email?.toLowerCase?.() ?? '';
  return posts.filter((post) => (
    post.authorHandle === handle ||
    post.authorEmail?.toLowerCase?.() === email ||
    post.author?.toLowerCase?.() === name
  ));
}

function getProfileEvents(profile, communityEvents = []) {
  if (!profile) return [];
  const ownerTokens = [
    profile.name,
    profile.handle?.replace('@', ''),
    profile.name === 'MeetPoint Oficial' ? 'MeetPoint' : '',
    profile.name === 'Marina Costa' ? 'MeetPoint' : '',
  ].filter(Boolean).map((token) => token.toLowerCase());

  return [...communityEvents, ...scheduledEvents].filter((event) => {
    if (event.creatorHandle === profile.handle) return true;
    const haystack = `${event.owner ?? ''} ${event.creatorName ?? ''} ${event.title ?? ''} ${event.description ?? ''}`.toLowerCase();
    return ownerTokens.some((token) => haystack.includes(token));
  });
}

function getProfileOpportunities(profile, jobs = []) {
  if (!profile) return [];
  const profileName = profile.name.toLowerCase();
  const handleName = profile.handle?.replace('@', '').toLowerCase() ?? '';

  return jobs.filter((job) => {
    if (job.creatorHandle === profile.handle) return true;
    const haystack = `${job.company ?? ''} ${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
    if (profile.name === 'MeetPoint Oficial') return ['MeetPoint', 'Clube de Benefícios'].includes(job.company);
    if (profile.name === 'Associação Empresarial') return ['Agência Norte', 'Hub Londrina Centro', 'Restaurante Central'].includes(job.company);
    return haystack.includes(profileName) || (handleName && haystack.includes(handleName));
  });
}

function getOwnProfileEvents(currentUser, communityEvents = []) {
  if (!currentUser) return [];
  const currentHandle = getUserHandle(currentUser);
  const tokens = [currentUser.name, currentUser.email].filter(Boolean).map((token) => token.toLowerCase());
  return [...communityEvents, ...scheduledEvents].filter((event) => {
    if (event.creatorHandle === currentHandle) return true;
    const owner = `${event.owner ?? ''} ${event.creatorName ?? ''} ${event.creatorEmail ?? ''}`.toLowerCase();
    return tokens.some((token) => owner.includes(token));
  });
}

function getOwnProfileOpportunities(currentUser, jobs = []) {
  if (!currentUser) return [];
  const currentHandle = getUserHandle(currentUser);
  const tokens = [currentUser.name, currentUser.company].filter(Boolean).map((token) => token.toLowerCase());
  return jobs.filter((job) => {
    if (job.creatorHandle === currentHandle || job.creatorEmail === currentUser.email) return true;
    const company = job.company?.toLowerCase?.() ?? '';
    return tokens.some((token) => company.includes(token));
  });
}

function getViewedProfileStats(profile, socialGraph, profilePosts = [], profileEvents = [], profileOpportunities = []) {
  const followerDelta = socialGraph?.followerDeltas?.[profile?.handle] ?? 0;
  return {
    friends: 0,
    followers: Math.max((profile?.followers ?? 0) + followerDelta, 0),
    following: 0,
    posts: profilePosts.length,
    events: profileEvents.length,
    opportunities: profileOpportunities.length,
  };
}

function getOwnProfileStats(socialGraph, profilePosts = [], profileEvents = [], profileOpportunities = []) {
  const defaultGraph = createDefaultSocialGraph();
  const graph = { ...defaultGraph, ...(socialGraph ?? {}) };
  return {
    friends: ownSocialBaseStats.friends + (graph.friendHandles.length - defaultGraph.friendHandles.length),
    followers: ownSocialBaseStats.followers + (graph.followerHandles.length - defaultGraph.followerHandles.length),
    following: ownSocialBaseStats.following + (graph.followingHandles.length - defaultGraph.followingHandles.length),
    posts: profilePosts.length,
    events: profileEvents.length,
    opportunities: profileOpportunities.length,
  };
}

function formatExactCount(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

function formatCountLabel(value, singular, plural) {
  return Number(value) === 1 ? singular : plural;
}

function getAccountTypeLabel(accountOrSegment) {
  const segment = typeof accountOrSegment === 'string'
    ? accountOrSegment
    : accountOrSegment?.segment;
  return {
    student: 'Pessoa Física',
    teacher: 'Pessoa Jurídica',
    company: 'Empresa',
    platform: 'Plataforma',
    employee: 'Equipe interna',
    pf: 'Pessoa Física',
    pj: 'Pessoa Jurídica',
  }[segment] ?? 'Conta';
}

function getAccountTypeCode(accountOrSegment) {
  const segment = typeof accountOrSegment === 'string'
    ? accountOrSegment
    : accountOrSegment?.segment;
  return {
    student: 'PF',
    teacher: 'PJ',
    company: 'Empresa',
    platform: 'Plataforma',
    employee: 'Interno',
    pf: 'PF',
    pj: 'PJ',
  }[segment] ?? 'Conta';
}

function getAccountSessionKey(account) {
  if (!account?.email) return '';
  const tenantScope = account.backendUser?.tenantId ?? account.tenantId ?? 'platform';
  return `${account.segment}:${account.email.toLowerCase()}:${tenantScope}`;
}

function createDefaultProfileInfo(account) {
  return {
    displayName: account?.name ?? '',
    city: account?.city && account?.state ? `${account.city}, ${account.state}` : account?.city ?? '',
    bio: account?.bio ?? '',
    linkedin: '',
    instagram: '',
    github: '',
    coverPhoto: '',
  };
}

function normalizeEditableProfileText(value, fallback, options = {}) {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalized) return fallback;

  const fallbackFirstWord = fallback?.trim().split(/\s+/)[0]?.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  const escapedFirstWord = fallbackFirstWord?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const firstWordMatches = fallbackFirstWord
    ? normalizedLower.match(new RegExp(`\\b${escapedFirstWord}\\b`, 'g'))?.length ?? 0
    : 0;
  const commaCount = (normalized.match(/,/g) ?? []).length;

  if (firstWordMatches > 1 || normalized.length > 80 || (options.singleLocation && commaCount > 1)) {
    return fallback;
  }

  return normalized;
}

function resolveProfileInfo(account, profileInfo = {}) {
  const defaults = createDefaultProfileInfo(account);
  return {
    ...defaults,
    ...profileInfo,
    displayName: normalizeEditableProfileText(profileInfo.displayName, defaults.displayName),
    bio: normalizeEditableProfileText(profileInfo.bio, defaults.bio),
    city: normalizeEditableProfileText(profileInfo.city, defaults.city, { singleLocation: true }),
  };
}

function createGuestWorkspace() {
  return {
    selectedCourseId: 'saas',
    createdCourses: [],
    editingCreatedCourseId: null,
    checkoutCourseId: null,
    enrollments: [],
    courseProgress: {},
    coursePaymentStatus: {},
    courseCompletionStep: {},
    profilePhoto: '',
    userPoints: 0,
    jobApplications: [],
    benefitRedemptions: [],
    notifications: [],
    notificationPrefs: { ...initialNotificationPrefs },
    socialGraph: createDefaultSocialGraph(),
    interestScores: {},
    profileResumeName: '',
    profileResumeDetails: createDefaultResumeDetails(),
    profilePublicInfo: createDefaultProfileInfo(null),
    visualPreferences: createDefaultVisualPreferences(),
  };
}

function createAccountWorkspace(account) {
  if (!account) return createGuestWorkspace();

  return {
    selectedCourseId: 'saas',
    createdCourses: [],
    editingCreatedCourseId: null,
    checkoutCourseId: null,
    enrollments: [],
    courseProgress: {},
    coursePaymentStatus: {},
    courseCompletionStep: {},
    profilePhoto: '',
    userPoints: 0,
    jobApplications: [],
    benefitRedemptions: [],
    notifications: [],
    notificationPrefs: { ...initialNotificationPrefs },
    socialGraph: createDefaultSocialGraph(),
    interestScores: {},
    profileResumeName: '',
    profileResumeDetails: {
      ...createDefaultResumeDetails(),
      mode: 'empty',
      fileName: '',
    },
    profilePublicInfo: createDefaultProfileInfo(account),
    visualPreferences: createDefaultVisualPreferences(),
  };
}

function App() {
  // Estado central da aplicação: páginas, autenticação, dados mockados e ações do usuário.
  const initialRoute = useMemo(() => getCurrentRouteState(), []);
  
  // Rotas com dados privados ou alteração de estado. Feed, oportunidades, eventos e benefícios são leitura pública.
  const protectedRoutes = ['courses', 'communities', 'rewards', 'private-chat', 'course-create', 'course-builder', 'checkout', 'community-create', 'event-create'];
  const subscriptionRequiredRoutes = ['courses', 'communities', 'rewards', 'private-chat', 'course-create', 'course-builder', 'checkout', 'community-create', 'event-create'];
  
  // Autenticação real: persiste apenas o token emitido pelo backend.
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') ?? '');

  function resolveAccessiblePage(pageId, user = currentUser) {
    if (user && pageId === 'home') return 'feed';
    if (user && ['platform', 'employee'].includes(user.segment) && pageId === 'private-chat') return 'profile';
    if (!user && protectedRoutes.includes(pageId)) return 'profile';
    if (user && !hasActivePlatformSubscription(user)) {
      return 'subscription-checkout';
    }
    return pageId;
  }
  
  const [activePage, setActivePage] = useState(() => {
    const startupRoute = !currentUser && isPublicDomainEntry() ? buildRouteState('feed') : initialRoute;
    return resolveAccessiblePage(startupRoute.page, currentUser);
  });
  const [authMode, setAuthMode] = useState(
    activePage === 'profile' && initialRoute.signupMode ? 'signup' : 'login',
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreAuthenticatedUser() {
      if (!authToken) {
        localStorage.removeItem('currentUser');
        return;
      }

      try {
        const result = await authenticatedUserRequest(authToken);
        if (cancelled) return;
        activateUserSession(mapBackendUserToAccount(result.user), authToken);
      } catch {
        if (cancelled) return;
        setAuthToken('');
        setCurrentUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
      }
    }

    restoreAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const [communities, setCommunities] = useState(initialCommunities);
  const [niches, setNiches] = useState(defaultNiches);
  const [activeCommunityId, setActiveCommunityId] = useState('growth');
  const [showMemberSuggestion, setShowMemberSuggestion] = useState(false);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [communityBubbleOpen, setCommunityBubbleOpen] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState({});
  const [eventCreatorAlerts, setEventCreatorAlerts] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('saas');
  const [createdCourses, setCreatedCourses] = useState([]);
  const [editingCreatedCourseId, setEditingCreatedCourseId] = useState(null);
  const [checkoutCourseId, setCheckoutCourseId] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [courseProgress, setCourseProgress] = useState({});
  const [coursePaymentStatus, setCoursePaymentStatus] = useState({});
  const [courseCompletionStep, setCourseCompletionStep] = useState({});
  const [profilePhoto, setProfilePhoto] = useState('');
  const [motionKey, setMotionKey] = useState(0);
  const [previousPage, setPreviousPage] = useState('home');
  const [feedPosts, setFeedPosts] = useState(initialFeedPosts);
  const [userPoints, setUserPoints] = useState(0);
  const [jobApplications, setJobApplications] = useState([]);
  const [benefits, setBenefits] = useState(initialBenefits);
  const [benefitRedemptions, setBenefitRedemptions] = useState([]);
  const [benefitEmailDeliveries, setBenefitEmailDeliveries] = useState([]);
  const [benefitRequests, setBenefitRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(benefitRequestStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [partnerLeads, setPartnerLeads] = useState([]);
  const [jobs, setJobs] = useState(initialJobs);
  const [notifications, setNotifications] = useState([]);
  const [notificationPrefs, setNotificationPrefs] = useState(initialNotificationPrefs);
  const [socialGraph, setSocialGraph] = useState(createDefaultSocialGraph);
  const [interestScores, setInterestScores] = useState({});
  const [profileResumeName, setProfileResumeName] = useState('');
  const [profileResumeDetails, setProfileResumeDetails] = useState(createDefaultResumeDetails);
  const [profilePublicInfo, setProfilePublicInfo] = useState(createDefaultProfileInfo(null));
  const [selectedPartnerPlanId, setSelectedPartnerPlanId] = useState('pf');
  const [profileSessions, setProfileSessions] = useState(() => {
    const sessionKey = getAccountSessionKey(currentUser);
    const storedWorkspace = readStoredWorkspace(currentUser);
    return sessionKey && storedWorkspace ? { [sessionKey]: storedWorkspace } : {};
  });
  const workspaceHydratedRef = useRef(false);
  const skipInitialWorkspacePersistRef = useRef(true);
  const [securityWarning, setSecurityWarning] = useState('');
  const [headerCompact, setHeaderCompact] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [privateChatOpen, setPrivateChatOpen] = useState(false);
  const [privateConversations, setPrivateConversations] = useState(initialPrivateConversations);
  const [requestedPrivateConversation, setRequestedPrivateConversation] = useState(null);
  const [communityAccessRequest, setCommunityAccessRequest] = useState(null);
  const [communityAccessNotice, setCommunityAccessNotice] = useState('');
  const [mediaViewer, setMediaViewer] = useState(null);
  const [mediaViewerScrollY, setMediaViewerScrollY] = useState(0);
  const [mediaViewerFocusElement, setMediaViewerFocusElement] = useState(null);
  const [visualPreferences, setVisualPreferences] = useState(() =>
    readStoredVisualPreferences(currentUser),
  );
  const [systemThemeTick, setSystemThemeTick] = useState(0);
  const [notificationDockOpen, setNotificationDockOpen] = useState(false);
  const [supportRequestContext, setSupportRequestContext] = useState(null);
  const [privacyGate, setPrivacyGate] = useState(null);
  const [authGate, setAuthGate] = useState(null);
  const [subscriptionGate, setSubscriptionGate] = useState(null);

  const activeCommunity = useMemo(
    () => communities.find((community) => community.id === activeCommunityId),
    [activeCommunityId, communities],
  );

  const catalogCourses = useMemo(
    () => [...initialCourses, ...createdCourses.filter((course) => course.published)],
    [createdCourses],
  );

  const selectedCourse = useMemo(
    () => catalogCourses.find((course) => course.id === selectedCourseId) ?? catalogCourses[0],
    [catalogCourses, selectedCourseId],
  );
  const canPublishCourses = ['student', 'teacher', 'company', 'platform'].includes(
    currentUser?.segment,
  );
  const canCreateEvents = ['student', 'teacher', 'company', 'platform'].includes(
    currentUser?.segment,
  );
  const resolvedProfileInfo = resolveProfileInfo(currentUser, profilePublicInfo);
  const accountDisplayName = currentUser
    ? resolvedProfileInfo.displayName
    : 'Entrar';
  const eventCreatorUnreadCount = currentUser
    ? eventCreatorAlerts.filter(
        (alert) =>
          !alert.read &&
          (alert.creatorEmail === currentUser.email || alert.creatorName === currentUser.name),
      ).length
    : 0;
  const visibleNavigation = useMemo(
    () =>
      currentUser
        ? navigation.filter((item) =>
            hasActivePlatformSubscription(currentUser)
              ? item.id !== 'home'
              : subscriptionPendingPageIds.includes(item.id),
          )
        : navigation.filter((item) => publicReadPageIds.includes(item.id)),
    [currentUser],
  );
  const visiblePrimaryMobilePageIds = currentUser
    ? loggedInPrimaryMobilePageIds
    : guestPrimaryMobilePageIds;
  const primaryMobileNavigation = visibleNavigation.filter((item) =>
    visiblePrimaryMobilePageIds.includes(item.id),
  );
  const secondaryMobileNavigation = visibleNavigation.filter((item) =>
    !visiblePrimaryMobilePageIds.includes(item.id),
  );

  function openMediaViewer(payload) {
    if (!payload?.src) return;
    setMediaViewerScrollY(window.scrollY);
    setMediaViewerFocusElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    setMediaViewer(payload);
  }

  function closeMediaViewer() {
    setMediaViewer(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: mediaViewerScrollY, behavior: 'auto' });
      mediaViewerFocusElement?.focus?.();
    });
  }

  function openSupportChannel(context = {}) {
    setSupportRequestContext({
      id: Date.now(),
      mode: 'ai',
      ...context,
    });
  }

  function requestAuthentication(actionLabel = 'continuar') {
    setAuthGate({
      id: Date.now(),
      actionLabel,
    });
  }

  function requestPrivacyConsent(actionLabel = 'continuar') {
    setPrivacyGate({
      id: Date.now(),
      actionLabel,
    });
  }

  function requestSubscriptionActivation(actionLabel = 'continuar') {
    setSubscriptionGate({
      id: Date.now(),
      actionLabel,
    });
  }

  async function acceptPrivacyConsent() {
    if (!currentUser) {
      setPrivacyGate(null);
      requestAuthentication('aceitar termos de privacidade');
      return;
    }

    const fallbackConsent = createPrivacyConsentRecord(currentUser.id ?? currentUser.email);
    let privacyConsent = fallbackConsent;
    try {
      privacyConsent = await privacyConsentRequest(fallbackConsent);
    } catch {
      privacyConsent = fallbackConsent;
    }
    const nextUser = {
      ...currentUser,
      termsConsent: {
        ...(currentUser.termsConsent ?? {}),
        termsVersion: TERMS_VERSION,
        acceptedAt: privacyConsent.acceptedAt,
        userAgent: privacyConsent.userAgent,
      },
      privacyConsent,
    };
    setCurrentUser(nextUser);
    localStorage.removeItem('currentUser');
    setPrivacyGate(null);
  }

  function markSubscriptionPaymentProcessing(plan, intent = {}) {
    if (!currentUser) return;
    const nextUser = {
      ...currentUser,
      accountStatus: 'PAYMENT_PROCESSING',
      subscriptionActive: false,
      subscription: {
        ...createPendingSubscriptionRecord(plan?.id ?? ''),
        planId: plan?.id ?? '',
        subscriptionPlanId: plan?.subscriptionPlanId ?? '',
        status: intent.status ?? 'PENDING_PAYMENT',
        paymentProvider: intent.paymentProvider ?? 'mock',
        externalSubscriptionId: intent.externalSubscriptionId ?? '',
      },
    };
    setCurrentUser(nextUser);
    localStorage.removeItem('currentUser');
  }

  function requireAuthenticatedAction(actionLabel) {
    if (currentUser) {
      if (!hasValidPrivacyConsent(currentUser)) {
        requestPrivacyConsent(actionLabel);
        return false;
      }
      if (!hasActivePlatformSubscription(currentUser)) {
        requestSubscriptionActivation(actionLabel);
        return false;
      }
      return true;
    }
    requestAuthentication(actionLabel);
    return false;
  }

  function requireAuthenticatedConsent(actionLabel) {
    if (currentUser && hasValidPrivacyConsent(currentUser)) return true;
    if (currentUser) {
      requestPrivacyConsent(actionLabel);
      return false;
    }
    requestAuthentication(actionLabel);
    return false;
  }

  // Rota inicial e botao voltar do navegador: mantem query string e tela ativa sincronizadas.
  useEffect(() => {
    const rawInitialRoute = getCurrentRouteState();
    const lockedRoute = getLockedRoute();
    const initialRoute = !currentUser && isPublicDomainEntry()
      ? buildRouteState('feed')
      : lockedRoute
        ? buildRouteState(lockedRoute)
        : rawInitialRoute;
    const initialPage = resolveAccessiblePage(initialRoute.page, currentUser);
    const initialHistoryRoute =
      initialPage === initialRoute.page
        ? initialRoute
        : buildRouteState(initialPage);

    window.history.replaceState(
      initialHistoryRoute.historyState,
      '',
      initialHistoryRoute.url,
    );
    setActivePage(initialPage);
    if (initialPage === 'profile' && initialRoute.signupMode) {
      setAuthMode('signup');
    } else if (initialPage !== 'profile') {
      setAuthMode('login');
    }

    function handleBrowserNavigation(event) {
      const route = getCurrentRouteState(event.state);
      const nextPage = resolveAccessiblePage(route.page);
      setActivePage(nextPage);
      if (nextPage === 'profile') {
        setAuthMode(route.signupMode ? 'signup' : 'login');
      }
      if (nextPage !== route.page) {
        const correctedRoute = buildRouteState(nextPage);
        window.history.replaceState(correctedRoute.historyState, '', correctedRoute.url);
      }
      setMotionKey((value) => value + 1);
    }

    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, []);

  // Protecao visual de conteudo: dificulta inspecao casual, copia e extracao de materiais.
  useEffect(() => {
    function warnSecurity(message) {
      setSecurityWarning(message);
      window.clearTimeout(warnSecurity.timeoutId);
      warnSecurity.timeoutId = window.setTimeout(() => setSecurityWarning(''), 4200);
    }

    function blockProtectedAction(event) {
      const target = event.target;
      const editableField = target?.closest?.('input, textarea, [contenteditable="true"]');
      const protectedPasswordField = target?.closest?.('[data-protected-password="true"]');
      if (protectedPasswordField && ['contextmenu', 'copy', 'cut', 'dragstart'].includes(event.type)) {
        event.preventDefault();
        warnSecurity('Esta ação está bloqueada no campo de senha.');
        return;
      }
      if (editableField) {
        if (event.type === 'contextmenu' || event.type === 'dragstart') {
          event.preventDefault();
          warnSecurity('O botão direito está bloqueado nos campos da plataforma.');
        }
        return;
      }
      const protectedArea = target?.closest?.('.protected-content, .course-module-planner, .course-detail-curriculum, .post-media');
      if (event.type === 'contextmenu') {
        event.preventDefault();
        warnSecurity('O botão direito está bloqueado.');
        return;
      }
      if (protectedArea) {
        event.preventDefault();
        warnSecurity('Esta ação não está disponível nesta área da plataforma.');
        return;
      }
      if (event.type === 'selectstart') {
        event.preventDefault();
      }
    }

    function blockShortcut(event) {
      const key = event.key.toLowerCase();
      const suspicious =
        event.key === 'F12' ||
        ((event.metaKey || event.ctrlKey) && ['s', 'u', 'p'].includes(key)) ||
        ((event.metaKey || event.ctrlKey) && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        ((event.metaKey || event.ctrlKey) && event.altKey && ['i', 'j', 'c', 'u'].includes(key));
      if (!suspicious) return;
      event.preventDefault();
      event.stopPropagation();
      warnSecurity('Inspecao e extracao de codigo nao estao disponiveis nesta plataforma.');
    }

    window.addEventListener('contextmenu', blockProtectedAction);
    window.addEventListener('copy', blockProtectedAction);
    window.addEventListener('cut', blockProtectedAction);
    window.addEventListener('dragstart', blockProtectedAction);
    window.addEventListener('selectstart', blockProtectedAction);
    window.addEventListener('keydown', blockShortcut);
    return () => {
      window.removeEventListener('contextmenu', blockProtectedAction);
      window.removeEventListener('copy', blockProtectedAction);
      window.removeEventListener('cut', blockProtectedAction);
      window.removeEventListener('dragstart', blockProtectedAction);
      window.removeEventListener('selectstart', blockProtectedAction);
      window.removeEventListener('keydown', blockShortcut);
      window.clearTimeout(warnSecurity.timeoutId);
    };
  }, []);

  // Header inteligente: compacta a barra ao voltar a rolagem para aproveitar melhor a tela.
  useEffect(() => {
    let lastScrollY = window.scrollY;

    function handleSmartHeader() {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY;
      setHeaderCompact(isScrollingUp && currentScrollY > 80);
      lastScrollY = currentScrollY;
    }

    window.addEventListener('scroll', handleSmartHeader, { passive: true });
    return () => window.removeEventListener('scroll', handleSmartHeader);
  }, []);

  // Modais e paineis abertos: trava scroll do fundo e leva a tela ate a janela aberta.
  // Essa regra cobre cliques que abrem chat, formulários, detalhes, avisos e modais.
  useEffect(() => {
    const visibleLayerSelectors = [
      '.floating-backdrop',
      '.floating-modal-layer',
      '.mobile-more-backdrop',
      '.floating-modal',
      '.mobile-more-sheet',
      '.reaction-detail-popover',
      '.comment-panel',
      '.private-chat-window',
      '.support-panel',
      '.notification-dock-window',
      '.company-applications-panel',
      '.inline-page-notice',
      '.event-response-board',
      '.community-chat-inline',
      '.community-details-modal',
      '.compact-event-actions-modal',
      '.social-profile-modal',
      '.job-detail-modal',
      '.resume-create-modal',
      '.job-create-modal',
      '.application-modal',
      '.event-payment-modal',
      '.community-access-modal',
      '.system-customization-modal',
      '.signup-layout',
      '.signup-profile-setup',
      '.course-builder-layout',
    ];
    const modalSelector = [
      '.floating-backdrop',
      '.floating-modal-layer',
      '.mobile-more-backdrop',
      '.floating-modal',
      '.mobile-more-sheet',
    ].join(',');
    const actionableSelector = visibleLayerSelectors.join(',');

    function isElementInViewport(element) {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      return (
        rect.top >= 12 &&
        rect.left >= 0 &&
        rect.bottom <= viewportHeight - 12 &&
        rect.right <= viewportWidth
      );
    }

    function shouldScrollToElement(element) {
      if (!element || !element.isConnected) return false;
      if (element.closest('.floating-backdrop, .floating-modal-layer, .mobile-more-backdrop')) return false;
      return window.getComputedStyle(element).position !== 'fixed';
    }

    function focusFirstAction(element) {
      const target = element.querySelector?.(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      target?.focus?.({ preventScroll: true });
    }

    function revealOpenedLayer(element, block = 'center') {
      if (!element || !element.isConnected) return;
      if (element.matches(modalSelector) || element.closest(modalSelector)) {
        window.requestAnimationFrame(() => {
          focusFirstAction(element.matches('.floating-modal, .mobile-more-sheet') ? element : element.querySelector?.('.floating-modal, .mobile-more-sheet') ?? element);
        });
        return;
      }
      if (!shouldScrollToElement(element) || isElementInViewport(element)) return;
      window.requestAnimationFrame(() => {
        element.scrollIntoView({
          behavior: 'smooth',
          block,
          inline: 'nearest',
        });
        focusFirstAction(element);
      });
    }

    function syncModalState() {
      const hasModal = Boolean(
        document.querySelector('.floating-backdrop, .floating-modal-layer, .mobile-more-backdrop'),
      );
      document.body.classList.toggle('modal-open', hasModal);
    }

    const observer = new MutationObserver((mutations) => {
      let targetToReveal = null;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target instanceof Element && target.matches('details[open]')) {
            targetToReveal = target;
          }
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (!targetToReveal && node.matches(actionableSelector)) {
            targetToReveal = node;
          }
          if (!targetToReveal) {
            targetToReveal = node.querySelector?.(actionableSelector);
          }
        });
      });

      syncModalState();
      if (targetToReveal) {
        revealOpenedLayer(
          targetToReveal,
          targetToReveal.matches?.('.community-chat-inline, .course-builder-layout, .signup-layout, .signup-profile-setup')
            ? 'start'
            : 'center',
        );
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    syncModalState();

    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-open');
    };
  }, []);

  // Menus nativos tipo <details>: qualquer clique fora fecha o painel aberto.
  useEffect(() => {
    function closeOpenDetailsOnOutsideClick(event) {
      document.querySelectorAll('details[open]').forEach((detail) => {
        if (detail.contains(event.target)) return;
        detail.removeAttribute('open');
      });
    }

    document.addEventListener('pointerdown', closeOpenDetailsOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOpenDetailsOnOutsideClick);
  }, []);

  // Animacao de entrada por scroll: cards aparecem aos poucos quando entram no viewport.
  useEffect(() => {
    const animatedElements = document.querySelectorAll(
      [
        '.job-card',
        '.event-card',
        '.partner-plan-card',
        '.profile-card',
        '.module-card',
        '.benefit-card',
        '.resume-card',
        '.trend-panel',
        '.monetization-panel',
        '.spotlight-card',
        '.mini-card',
        '.suggestion-grid article',
        '.home-flow-strip article',
        '.course-card',
        '.product-card',
        '.course-settings-card',
        '.module-builder-card',
        '.course-module-planner',
        '.course-publish-panel',
        '.course-detail-curriculum article',
        '.admin-card',
      ].join(','),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('material-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    );

    animatedElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activePage, motionKey, jobs.length, communityEvents.length, createdCourses.length, currentUser?.email, userPoints]);

  // Sessao por perfil: restaura o workspace persistido no reload da SPA.
  useEffect(() => {
    if (workspaceHydratedRef.current) return;
    workspaceHydratedRef.current = true;
    const sessionKey = getAccountSessionKey(currentUser);
    if (!sessionKey) return;
    const restoredWorkspace =
      profileSessions[sessionKey] ??
      readStoredWorkspace(currentUser) ??
      createAccountWorkspace(currentUser);
    setProfileSessions((current) => ({
      ...current,
      [sessionKey]: restoredWorkspace,
    }));
    applyWorkspaceSnapshot(restoredWorkspace, currentUser);
  }, []);

  // Sessao por perfil: salva o estado local de cada conta para evitar misturar PF, PJ e empresa.
  useEffect(() => {
    const sessionKey = getAccountSessionKey(currentUser);
    if (!sessionKey) return;
    if (skipInitialWorkspacePersistRef.current) {
      skipInitialWorkspacePersistRef.current = false;
      return;
    }
    const snapshot = getCurrentWorkspaceSnapshot();
    setProfileSessions((current) => ({
      ...current,
      [sessionKey]: snapshot,
    }));
    writeStoredWorkspace(currentUser, snapshot);
  }, [
    currentUser?.email,
    currentUser?.segment,
    selectedCourseId,
    createdCourses,
    editingCreatedCourseId,
    checkoutCourseId,
    enrollments,
    courseProgress,
    coursePaymentStatus,
    courseCompletionStep,
    profilePhoto,
    userPoints,
    jobApplications,
    benefitRedemptions,
    notifications,
    notificationPrefs,
    socialGraph,
    interestScores,
    profileResumeName,
    profileResumeDetails,
    profilePublicInfo,
    privateConversations,
    visualPreferences,
  ]);

  // Personalizacao persistente: tema e cores ficam salvos por conta e sobrevivem a reload.
  useEffect(() => {
    try {
      localStorage.setItem(
        getVisualPreferencesStorageKey(currentUser),
        JSON.stringify(normalizeVisualPreferences(visualPreferences)),
      );
    } catch {
      // Sem armazenamento local, a preferencia permanece apenas na sessao atual.
    }
  }, [currentUser?.email, currentUser?.segment, currentUser?.tenantId, visualPreferences]);

  useEffect(() => {
    try {
      localStorage.setItem(benefitRequestStorageKey, JSON.stringify(benefitRequests));
    } catch {
      // Sem armazenamento local, as solicitacoes ficam apenas na sessao atual.
    }
  }, [benefitRequests]);

  // Tema automatico: atualiza a interface quando o sistema alterna entre claro e escuro.
  useEffect(() => {
    const themeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!themeQuery) return undefined;

    const handleSystemThemeChange = () => setSystemThemeTick((tick) => tick + 1);
    if (themeQuery.addEventListener) {
      themeQuery.addEventListener('change', handleSystemThemeChange);
      return () => themeQuery.removeEventListener('change', handleSystemThemeChange);
    }
    themeQuery.addListener(handleSystemThemeChange);
    return () => themeQuery.removeListener(handleSystemThemeChange);
  }, []);

  // Tema visual: aplica cores e filtros escolhidos no perfil em variaveis CSS globais.
  useEffect(() => {
    const root = document.documentElement;
    const rawMode = visualPreferences.mode ?? defaultVisualPreferences.mode;
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const effectiveMode = rawMode === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : rawMode;
    root.dataset.theme = effectiveMode;
    root.dataset.themeMode = rawMode;
    const baseLightPalette = rawMode === 'auto'
      ? defaultVisualPreferences
      : visualPreferences;
    const darkModePalette = effectiveMode === 'dark'
      ? {
          primary: '#101216',
          secondary: '#2c3340',
          button: '#f8fafc',
          highlight: '#8d97a8',
          text: '#f8fafc',
        }
      : {
          primary: baseLightPalette.primary,
          secondary: baseLightPalette.secondary,
          button: baseLightPalette.button,
          highlight: baseLightPalette.highlight,
          text: baseLightPalette.text ?? defaultVisualPreferences.text,
        };
    const readableText = getReadableTextColor(darkModePalette.secondary, darkModePalette.text);
    const buttonText = getReadableTextColor(darkModePalette.button);
    const highlightText = getReadableTextColor(darkModePalette.highlight);
    root.style.setProperty('--custom-primary', darkModePalette.primary);
    root.style.setProperty('--custom-secondary', darkModePalette.secondary);
    root.style.setProperty('--custom-button', darkModePalette.button);
    root.style.setProperty('--custom-highlight', darkModePalette.highlight);
    root.style.setProperty('--custom-text', readableText);
    root.style.setProperty('--custom-button-text', buttonText);
    root.style.setProperty('--custom-highlight-text', highlightText);
    root.style.setProperty('--image-dim-opacity', `${visualPreferences.imageDim / 100}`);
    root.style.setProperty('--image-brightness', `${visualPreferences.imageBrightness}%`);
    root.style.setProperty(
      '--image-filter-mode',
      visualPreferences.imageFilter === 'grayscale'
        ? 'grayscale(0.55)'
        : visualPreferences.imageFilter === 'warm'
          ? 'sepia(0.22) saturate(1.08)'
          : visualPreferences.imageFilter === 'cool'
            ? 'saturate(0.92) hue-rotate(8deg)'
            : 'none',
    );
  }, [visualPreferences, systemThemeTick]);

  // Captura tudo que pertence ao workspace visual da conta ativa.
  function getCurrentWorkspaceSnapshot() {
    return {
      selectedCourseId,
      createdCourses,
      editingCreatedCourseId,
      checkoutCourseId,
      enrollments,
      courseProgress,
      coursePaymentStatus,
      courseCompletionStep,
      profilePhoto,
      userPoints,
      jobApplications,
      benefitRedemptions,
      notifications,
      notificationPrefs,
      socialGraph,
      interestScores,
      profileResumeName,
      profileResumeDetails,
      profilePublicInfo,
      privateConversations,
      visualPreferences,
    };
  }

  // Restaura o workspace de uma conta quando ela entra novamente.
  function applyWorkspaceSnapshot(snapshot, accountForDefaults = currentUser) {
    const normalizedSnapshot = normalizeWorkspaceSnapshot(snapshot, accountForDefaults);
    setSelectedCourseId(normalizedSnapshot.selectedCourseId ?? 'saas');
    setCreatedCourses(normalizedSnapshot.createdCourses ?? []);
    setEditingCreatedCourseId(normalizedSnapshot.editingCreatedCourseId ?? null);
    setCheckoutCourseId(normalizedSnapshot.checkoutCourseId ?? null);
    setEnrollments(normalizedSnapshot.enrollments ?? []);
    setCourseProgress(normalizedSnapshot.courseProgress ?? {});
    setCoursePaymentStatus(normalizedSnapshot.coursePaymentStatus ?? {});
    setCourseCompletionStep(normalizedSnapshot.courseCompletionStep ?? {});
    setProfilePhoto(normalizedSnapshot.profilePhoto ?? '');
    setUserPoints(normalizedSnapshot.userPoints ?? 0);
    setJobApplications(normalizedSnapshot.jobApplications ?? []);
    setBenefitRedemptions(normalizedSnapshot.benefitRedemptions ?? []);
    setNotifications(normalizedSnapshot.notifications ?? []);
    setNotificationPrefs(normalizedSnapshot.notificationPrefs ?? { ...initialNotificationPrefs });
    setSocialGraph(normalizedSnapshot.socialGraph ?? createDefaultSocialGraph());
    setInterestScores(normalizedSnapshot.interestScores ?? {});
    setProfileResumeName(normalizedSnapshot.profileResumeName ?? '');
    setProfileResumeDetails({
      ...createDefaultResumeDetails(),
      ...(normalizedSnapshot.profileResumeDetails ?? {}),
    });
    setProfilePublicInfo(normalizedSnapshot.profilePublicInfo);
    setPrivateConversations(normalizedSnapshot.privateConversations ?? initialPrivateConversations);
    setVisualPreferences(
      normalizeVisualPreferences({
        ...(normalizedSnapshot.visualPreferences ?? {}),
        ...readStoredVisualPreferences(accountForDefaults),
      }),
    );
  }

  // Login real/API: troca a conta ativa e carrega o estado isolado daquele perfil.
  function activateUserSession(account, token = '') {
    const previousSessionKey = getAccountSessionKey(currentUser);
    const nextSessionKey = getAccountSessionKey(account);
    const nextWorkspace =
      profileSessions[nextSessionKey] ??
      readStoredWorkspace(account) ??
      createAccountWorkspace(account);

    if (previousSessionKey) {
      const previousSnapshot = getCurrentWorkspaceSnapshot();
      setProfileSessions((current) => ({
        ...current,
        [previousSessionKey]: previousSnapshot,
      }));
      writeStoredWorkspace(currentUser, previousSnapshot);
    }

    setCurrentUser(account);
    setAuthToken(token);
    localStorage.removeItem('currentUser');
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
    applyWorkspaceSnapshot(nextWorkspace, account);
    const pendingSubscriptionEmail = localStorage.getItem(LAST_SIGNUP_REQUIRES_SUBSCRIPTION_KEY);
    const shouldOpenSubscriptionCheckout =
      pendingSubscriptionEmail === account.email?.toLowerCase() ||
      !hasActivePlatformSubscription(account);
    if (shouldOpenSubscriptionCheckout) {
      localStorage.removeItem(LAST_SIGNUP_REQUIRES_SUBSCRIPTION_KEY);
      setLockedRoute('subscription-checkout');
      setSelectedPartnerPlanId(account.segment === 'teacher' || account.segment === 'company' ? 'pj' : 'pf');
      setPreviousPage('profile');
      setActivePage('subscription-checkout');
      syncBrowserHistory('subscription-checkout');
    } else {
      setLockedRoute('');
      setPreviousPage('profile');
      setActivePage('feed');
      syncBrowserHistory('feed');
    }
    setMotionKey((value) => value + 1);
  }

  // Sair da conta: salva a sessao atual e volta para o workspace de visitante.
  function logoutCurrentUser() {
    const sessionKey = getAccountSessionKey(currentUser);
    if (sessionKey) {
      const snapshot = getCurrentWorkspaceSnapshot();
      setProfileSessions((current) => ({
        ...current,
        [sessionKey]: snapshot,
      }));
      writeStoredWorkspace(currentUser, snapshot);
    }
    setCurrentUser(null);
    setAuthToken('');
    // Limpar dados de autenticação do localStorage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    setLockedRoute('');
    applyWorkspaceSnapshot(createGuestWorkspace(), null);
    openPage('feed', { allowHome: true });
  }

  // Navegacao SPA: atualiza a URL sem recarregar a aplicacao.
  function syncBrowserHistory(pageId, options = {}) {
    const route = buildRouteState(pageId, options);
    window.history.pushState(route.historyState, '', route.url);
  }

  // Troca de pagina principal: fecha menus mobile, anima a entrada e reseta modos de auth.
  function openPage(pageId, options = {}) {
    setMobileMoreOpen(false);
    const targetPageId = currentUser && pageId === 'home' && !options.allowHome ? 'feed' : pageId;
    const signupSegment = options.signupSegment ?? null;
    const signupChoice = Boolean(options.signupChoice);
    if (targetPageId === 'communities' && !options.preserveCommunityOpen) {
      setCommunityBubbleOpen(false);
    }

    if (currentUser && ['platform', 'employee'].includes(currentUser.segment) && targetPageId === 'private-chat') {
      setPreviousPage(activePage);
      setActivePage('profile');
      syncBrowserHistory('profile');
      setMotionKey((value) => value + 1);
      return;
    }
    
    // Verifica se a rota é protegida e o usuário não está autenticado
    if (protectedRoutes.includes(targetPageId) && !currentUser) {
      setAuthMode('signup');
      setPreviousPage(activePage);
      setActivePage('profile');
      syncBrowserHistory('profile', { signupChoice: true });
      setMotionKey((value) => value + 1);
      return;
    }

    if (currentUser && !hasActivePlatformSubscription(currentUser) && !subscriptionPendingPageIds.includes(targetPageId)) {
      requestSubscriptionActivation(`acessar ${getPageLabel(targetPageId)}`);
      setLockedRoute('subscription-checkout');
      setPreviousPage(activePage);
      setSelectedPartnerPlanId(currentUser.segment === 'teacher' || currentUser.segment === 'company' ? 'pj' : 'pf');
      setActivePage('subscription-checkout');
      syncBrowserHistory('subscription-checkout');
      setMotionKey((value) => value + 1);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 80);
      return;
    }
    
    const shouldAnimate =
      targetPageId !== activePage ||
      getSignupSegmentFromUrl() !== signupSegment;

    if (targetPageId !== activePage) {
      setPreviousPage(activePage);
      setActivePage(targetPageId);
    }

    if (targetPageId === 'profile') {
      setAuthMode(signupSegment || signupChoice ? 'signup' : 'login');
    } else if (authMode !== 'login') {
      setAuthMode('login');
    }

    syncBrowserHistory(targetPageId, { signupSegment, signupChoice });
    if (!shouldAnimate) return;
    setMotionKey((value) => value + 1);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  }

  // Botao Voltar interno: prioriza a pagina anterior real e usa fallback so sem historico interno.
  function goBack(fallbackPage) {
    const requestedFallback = typeof fallbackPage === 'string' ? fallbackPage : null;
    const pageFallbacks = {
      checkout: 'courses',
      'course-create': 'courses',
      'course-builder': 'courses',
      'community-create': 'communities',
      'event-create': 'events',
      'subscription-checkout': 'partners',
    };
    const target =
      previousPage && previousPage !== activePage
        ? previousPage
        : requestedFallback ?? pageFallbacks[activePage] ?? 'home';

    openPage(target);
  }

  function enterCommunity(communityId) {
    setActiveCommunityId(communityId);
    setCommunityBubbleOpen(true);
    openPage('communities', { preserveCommunityOpen: true });
    setTimeout(() => {
      document.querySelector('.community-chat-inline')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
  }

  function openCommunity(communityId) {
    if (!requireAuthenticatedAction('entrar em comunidade')) return;
    const community = communities.find((item) => item.id === communityId);
    if (!community) return;

    if (isCommunityPrivate(community) && !community.isAdmin && !community.joined) {
      setCommunityAccessNotice('');
      setCommunityAccessRequest({ communityId, password: '' });
      return;
    }

    enterCommunity(communityId);
  }

  function confirmCommunityAccess(password = '') {
    if (!requireAuthenticatedAction('entrar em comunidade privada')) return;
    const community = communities.find((item) => item.id === communityAccessRequest?.communityId);
    if (!community) return;

    const accessMode = getCommunityAccessMode(community);
    if (accessMode === 'invite') {
      setCommunityAccessNotice('Essa comunidade só aceita entrada por convite do administrador.');
      return;
    }

    if (accessMode === 'password' && String(community.password ?? '') !== password.trim()) {
      setCommunityAccessNotice('Senha incorreta para esta comunidade.');
      return;
    }

    setCommunities((current) =>
      current.map((item) =>
        item.id === community.id
          ? { ...item, joined: true, members: (item.members ?? 0) + 1 }
          : item,
      ),
    );
    setCommunityAccessRequest(null);
    setCommunityAccessNotice('');
    enterCommunity(community.id);
  }

  function openCommunityCreate() {
    if (!requireAuthenticatedAction('criar comunidade')) return;
    openPage('community-create');
  }

  // Comunidades: cria grupo, seleciona automaticamente e sugere adicionar membros.
  function createCommunity(data) {
    if (!requireAuthenticatedAction('criar comunidade')) return;
    const community = {
      id: `community-${Date.now()}`,
      name: data.name,
      topic: data.topic,
      type: data.type,
      relatedTo: data.relatedTo,
      photo: data.photo ?? '',
      members: 1,
      unread: 0,
      privacy: data.accessMode === 'public' ? 'Público' : 'Privada',
      accessMode: data.accessMode,
      password: data.accessMode === 'password' ? data.password : '',
      joined: true,
      isAdmin: true,
      favorite: false,
      color: data.color,
    };
    setCommunities((current) => [community, ...current]);
    setActiveCommunityId(community.id);
    setCommunityBubbleOpen(true);
    setShowMemberSuggestion(true);
    openPage('communities', { preserveCommunityOpen: true });
  }

  function toggleFavorite(communityId) {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? { ...community, favorite: !community.favorite }
          : community,
      ),
    );
  }

  function removeCommunityMember(communityId) {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? { ...community, members: Math.max((community.members ?? 0) - 1, 0) }
          : community,
      ),
    );
  }

  function addCommunityMember(communityId) {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? { ...community, members: (community.members ?? 0) + 1 }
          : community,
      ),
    );
  }

  function updateCommunityName(communityId, nextName) {
    const name = nextName.trim();
    if (!name) return;

    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId ? { ...community, name } : community,
      ),
    );
  }

  function updateCommunityPhoto(communityId, photo) {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId ? { ...community, photo } : community,
      ),
    );
  }

  // Exclusao segura: comunidade so pode ser removida pelo admin quando estiver vazia.
  function deleteEmptyCommunity(communityId) {
    const community = communities.find((item) => item.id === communityId);
    if (!community?.isAdmin) {
      return 'Somente o administrador pode excluir a comunidade.';
    }
    if ((community.members ?? 0) > 0) {
      return 'Remova todos os membros antes de excluir a comunidade.';
    }

    const remainingCommunities = communities.filter((item) => item.id !== communityId);
    setCommunities(remainingCommunities);
    setActiveCommunityId(remainingCommunities[0]?.id ?? '');
    setCommunityBubbleOpen(false);
    return 'Comunidade vazia excluída.';
  }

  function addNiche(niche) {
    const normalizedNiche = niche.trim();
    if (!normalizedNiche) return;
    setNiches((current) =>
      current.includes(normalizedNiche) ? current : [...current, normalizedNiche],
    );
  }

  function addCommunityEvent(event) {
    const eventId = event.id ?? `event-${Date.now()}`;
    const mode = event.mode ?? 'Online';
    setCommunityEvents((current) => [
      {
        ...event,
        id: eventId,
        mode,
        owner: event.owner ?? currentUser?.name ?? 'MeetPoint',
        creatorName: event.creatorName ?? currentUser?.name ?? event.owner ?? 'MeetPoint',
        creatorEmail: event.creatorEmail ?? currentUser?.email ?? '',
        creatorHandle: event.creatorHandle ?? getUserHandle(currentUser),
        creatorSegment: event.creatorSegment ?? currentUser?.segment ?? 'local',
        location:
          event.location?.trim?.() ||
          (mode === 'Presencial' ? 'Local presencial a definir' : 'Sala online MeetPoint'),
        capacity: Number(event.capacity || 60),
        price: Number(event.price || 0),
        participants: event.participants ?? [],
        registrationRequired: event.registrationRequired ?? true,
        requiredFields: event.requiredFields ?? ['name', 'email', 'whatsapp'],
        yes: event.yes ?? 0,
        no: event.no ?? 0,
      },
      ...current,
    ]);
    openPage('events');
  }

  function dismissMemberSuggestion() {
    setShowMemberSuggestion(false);
  }

  function openCourse(courseId) {
    setSelectedCourseId(courseId);
    openPage('courses');
  }

  // Cursos: cria rascunho com escopo correto de PF, PJ, empresa ou plataforma.
  function createCourse(courseData) {
    if (!canPublishCourses) {
      openPage('profile');
      return;
    }
    const isStudent = currentUser?.segment === 'student';
    const isTeacher = currentUser?.segment === 'teacher';
    const isCompany = currentUser?.segment === 'company';
    const topic = resolveCourseTopic(courseData.topic ?? courseData.category, courseData.customTopic);
    const publicationScope =
      isTeacher && courseData.publicationMode === 'company' && courseData.linkedCompany
        ? 'Empresa vinculada'
        : isTeacher
          ? 'PJ autônoma'
          : isCompany
            ? 'Empresa'
            : isStudent
              ? 'PF autônoma'
              : 'Plataforma';
    const companyLabel =
      isTeacher && courseData.publicationMode === 'company' && courseData.linkedCompany
        ? courseData.linkedCompany
        : isTeacher
          ? 'Publicação autônoma'
          : isCompany
            ? currentUser?.name ?? 'Empresa'
            : isStudent
              ? 'Publicação pessoa física'
              : 'Plataforma';
    const course = {
      id: `created-${Date.now()}`,
      title: courseData.title || 'Novo curso',
      tag: topic,
      topic,
      description: courseData.description,
      price: courseData.isFree ? 0 : Number(courseData.price || 0),
      isFree: courseData.isFree,
      platformFeePercent: courseData.isFree ? 0 : PLATFORM_FEE_PERCENT,
      progress: 0,
      level: 'Rascunho',
      instructor: isCompany ? 'Equipe da empresa' : currentUser?.name ?? 'Você',
      company: companyLabel,
      publicationScope,
      deliveryMode: courseData.deliveryMode ?? 'internal',
      externalCourseUrl: normalizeExternalUrl(courseData.externalCourseUrl ?? ''),
      externalPlatformName: courseData.externalPlatformName ?? '',
      creatorSegment: currentUser?.segment ?? 'local',
      creatorEmail: currentUser?.email ?? '',
      liveDate: courseData.liveDate,
      color: courseData.isFree ? 'yellow' : 'blue',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      students: 0,
      revenue: 0,
      platformFeeRevenue: 0,
      producerNetRevenue: 0,
      published: false,
      modules: courseData.modules ?? [],
    };
    setCreatedCourses((current) => [course, ...current]);
    setEditingCreatedCourseId(course.id);
    openPage('course-builder');
  }

  function openCreatedCourse(courseId) {
    setEditingCreatedCourseId(courseId);
    openPage('course-builder');
  }

  // Publicacao do curso: simula vendas e split da taxa operacional da plataforma.
  function publishCreatedCourse(courseId) {
    setCreatedCourses((current) =>
      current.map((course) => {
        if (course.id !== courseId) return course;
        const students = course.isFree ? 0 : 12;
        const split = calculatePlatformSplit(course.price * students);
        return {
          ...course,
          published: true,
          updatedAt: new Date().toISOString(),
          students,
          revenue: split.gross,
          platformFeeRevenue: split.platformFee,
          producerNetRevenue: split.producerNet,
        };
      }),
    );
  }

  function updateCreatedCourse(courseId, patch) {
    setCreatedCourses((current) =>
      current.map((course) =>
        course.id === courseId
          ? { ...course, ...patch, updatedAt: new Date().toISOString() }
          : course,
      ),
    );
  }

  function updateCreatedCourseModules(courseId, modules) {
    setCreatedCourses((current) =>
      current.map((course) =>
        course.id === courseId
          ? { ...course, modules, updatedAt: new Date().toISOString() }
          : course,
      ),
    );
  }

  // Inscricao/checkout: curso gratis matricula direto; curso pago segue para pagamento.
  function startCheckout(courseId) {
    if (!currentUser) {
      openPage('profile');
      return;
    }
    const course = catalogCourses.find((item) => item.id === courseId);
    if (course?.isFree) {
      finishEnrollment(courseId);
      return;
    }
    setCheckoutCourseId(courseId);
    openPage('checkout');
  }

  // Finalizacao de matricula: grava curso no perfil e status de pagamento.
  function finishEnrollment(courseId, paymentStatus = 'paid') {
    setEnrollments((current) =>
      current.includes(courseId) ? current : [...current, courseId],
    );
    setCoursePaymentStatus((current) => ({
      ...current,
      [courseId]: paymentStatus,
    }));
    setCourseProgress((current) => ({
      ...current,
      [courseId]: current[courseId] ?? 0,
    }));
    setSelectedCourseId(courseId);
    openPage('profile');
  }

  // Progresso do aluno: aplica pesos por regra cumprida ate fechar 100%.
  function completeLesson(courseId) {
    if (!['paid', 'free'].includes(coursePaymentStatus[courseId])) return;
    const currentProgress = courseProgress[courseId] ?? 0;
    if (currentProgress >= 100) return;
    const plan = [
      { label: 'Assistir vídeo até o mínimo definido', weight: 10 },
      { label: 'Enviar tarefa solicitada', weight: 20 },
      { label: 'Finalizar módulo prático', weight: 70 },
    ];
    const step = courseCompletionStep[courseId] ?? 0;
    const nextAction = plan[Math.min(step, plan.length - 1)];
    setCourseProgress((current) => ({
      ...current,
      [courseId]: Math.min((current[courseId] ?? 0) + nextAction.weight, 100),
    }));
    setCourseCompletionStep((current) => ({
      ...current,
      [courseId]: Math.min(step + 1, plan.length - 1),
    }));
    awardPoints(nextAction.weight, nextAction.label);
  }

  function getPostTimestamp() {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Pontos e notificacoes: soma saldo e avisa quando um beneficio fica disponivel.
  function awardPoints(amount, reason) {
    const lowestBenefitCost = benefits.length
      ? Math.min(...benefits.map((benefit) => benefit.pointsCost))
      : 0;
    setUserPoints((current) => {
      const next = current + amount;
      setNotifications((items) => {
        const benefitNotice =
          lowestBenefitCost > 0 && current < lowestBenefitCost && next >= lowestBenefitCost
            ? [{
                id: `notice-benefit-${Date.now()}`,
                title: 'Você já tem pontos para resgatar um benefício.',
                channel: 'celular',
                read: false,
              }]
            : [];
        return [
          {
            id: `notice-points-${Date.now()}`,
            title: `+${amount} pontos: ${reason}`,
            channel: 'computador',
            read: false,
          },
          ...benefitNotice,
          ...items,
        ];
      });
      return next;
    });
  }

  function addNotification(notice) {
    setNotifications((current) => [
      {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        channel: 'computador',
        read: false,
        ...notice,
      },
      ...current,
    ]);
  }

  // Rede social: seguir, amizade, bloqueio e notificacoes ficam no App para valer em Feed e Perfil.
  function followProfile(handle) {
    if (!requireAuthenticatedAction('seguir perfil')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    const isBlocked = socialGraph.blockedHandles.includes(handle);
    if (isBlocked) {
      addNotification({
        title: `Desbloqueie ${profile.name} antes de seguir novamente.`,
        type: 'social-blocked',
        actorHandle: handle,
      });
      return;
    }

    const isFollowing = socialGraph.followingHandles.includes(handle);
    setSocialGraph((current) => ({
      ...current,
      followingHandles: isFollowing
        ? current.followingHandles.filter((item) => item !== handle)
        : uniqueItems([...current.followingHandles, handle]),
      followerDeltas: {
        ...current.followerDeltas,
        [handle]: Math.max((current.followerDeltas[handle] ?? 0) + (isFollowing ? -1 : 1), 0),
      },
    }));
    addNotification({
      title: isFollowing ? `Você deixou de seguir ${profile.name}.` : `Você começou a seguir ${profile.name}.`,
      type: isFollowing ? 'social-unfollow' : 'social-following',
      actorHandle: handle,
    });
  }

  function requestFriendship(handle) {
    if (!requireAuthenticatedAction('enviar solicitação de amizade')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    if (socialGraph.blockedHandles.includes(handle) || socialGraph.friendHandles.includes(handle)) return;

    setSocialGraph((current) => ({
      ...current,
      sentFriendRequestHandles: uniqueItems([...current.sentFriendRequestHandles, handle]),
    }));
    addNotification({
      title: `Solicitação de amizade enviada para ${profile.name}.`,
      type: 'friend-request-sent',
      actorHandle: handle,
    });
  }

  function resolveFriendship(handle, accepted) {
    if (!requireAuthenticatedAction(accepted ? 'aceitar amizade' : 'recusar amizade')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    setSocialGraph((current) => ({
      ...current,
      sentFriendRequestHandles: current.sentFriendRequestHandles.filter((item) => item !== handle),
      friendHandles: accepted ? uniqueItems([...current.friendHandles, handle]) : current.friendHandles,
      followingHandles: accepted ? uniqueItems([...current.followingHandles, handle]) : current.followingHandles,
      followerDeltas: accepted
        ? {
            ...current.followerDeltas,
            [handle]: Math.max((current.followerDeltas[handle] ?? 0) + (current.followingHandles.includes(handle) ? 0 : 1), 0),
          }
        : current.followerDeltas,
    }));
    addNotification({
      title: accepted ? `${profile.name} agora está nos seus amigos.` : `Solicitação para ${profile.name} foi cancelada.`,
      type: accepted ? 'friend-accepted' : 'friend-rejected',
      actorHandle: handle,
    });
  }

  function acceptIncomingFriendRequest(handle) {
    if (!requireAuthenticatedAction('aceitar amizade')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    setSocialGraph((current) => ({
      ...current,
      incomingFriendRequestHandles: current.incomingFriendRequestHandles.filter((item) => item !== handle),
      friendHandles: uniqueItems([...current.friendHandles, handle]),
      followerHandles: uniqueItems([...current.followerHandles, handle]),
    }));
    addNotification({
      title: `Você aceitou a solicitação de ${profile.name}.`,
      type: 'friend-accepted',
      actorHandle: handle,
    });
  }

  function rejectIncomingFriendRequest(handle) {
    if (!requireAuthenticatedAction('recusar amizade')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    setSocialGraph((current) => ({
      ...current,
      incomingFriendRequestHandles: current.incomingFriendRequestHandles.filter((item) => item !== handle),
    }));
    addNotification({
      title: `Você recusou a solicitação de ${profile.name}.`,
      type: 'friend-rejected',
      actorHandle: handle,
    });
  }

  function blockProfile(handle) {
    if (!requireAuthenticatedAction('bloquear perfil')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    const wasFollowing = socialGraph.followingHandles.includes(handle);
    setSocialGraph((current) => ({
      ...current,
      blockedHandles: uniqueItems([...current.blockedHandles, handle]),
      followingHandles: current.followingHandles.filter((item) => item !== handle),
      sentFriendRequestHandles: current.sentFriendRequestHandles.filter((item) => item !== handle),
      incomingFriendRequestHandles: current.incomingFriendRequestHandles.filter((item) => item !== handle),
      friendHandles: current.friendHandles.filter((item) => item !== handle),
      followerHandles: current.followerHandles.filter((item) => item !== handle),
      followerDeltas: {
        ...current.followerDeltas,
        [handle]: Math.max((current.followerDeltas[handle] ?? 0) - (wasFollowing ? 1 : 0), 0),
      },
    }));
    addNotification({
      title: `${profile.name} foi bloqueado. Você pode desbloquear no perfil.`,
      type: 'social-blocked',
      actorHandle: handle,
    });
  }

  function unblockProfile(handle) {
    if (!requireAuthenticatedAction('desbloquear perfil')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    setSocialGraph((current) => ({
      ...current,
      blockedHandles: current.blockedHandles.filter((item) => item !== handle),
    }));
    addNotification({
      title: `${profile.name} foi desbloqueado.`,
      type: 'social-unblocked',
      actorHandle: handle,
    });
  }

  function removeFollower(handle) {
    if (!requireAuthenticatedAction('remover seguidor')) return;
    const profile = getSocialProfileByHandle(handle) ?? getFallbackSocialProfile(handle);
    setSocialGraph((current) => ({
      ...current,
      followerHandles: current.followerHandles.filter((item) => item !== handle),
    }));
    addNotification({
      title: `${profile.name} foi removido dos seus seguidores.`,
      type: 'social-follower-removed',
      actorHandle: handle,
    });
  }

  function openPrivateConversationWithProfile(profile) {
    if (!profile) return;
    if (!requireAuthenticatedAction('enviar mensagem privada')) return;
    setPrivateConversations((current) => {
      const existing = current.find(
        (conversation) =>
          conversation.participantId === profile.id ||
          conversation.participantHandle === profile.handle,
      );
      if (existing) return current;

      return [
        {
          id: `conversation-${profile.id ?? profile.handle}`,
          participantId: profile.id ?? profile.handle,
          participantName: profile.name,
          participantHandle: profile.handle,
          participantInitials: profile.initials ?? getInitials(profile.name),
          participantPhoto: profile.photo,
          unread: 0,
          messages: [],
        },
        ...current,
      ];
    });
    setRequestedPrivateConversation(profile.handle);
    setPrivateChatOpen(true);
  }

  // Algoritmo de recomendacao local: cada interacao aumenta o peso dos nichos daquele post para a conta ativa.
  function recordFeedInterest(postOrId, action = 'view') {
    const post = typeof postOrId === 'string'
      ? feedPosts.find((item) => item.id === postOrId)
      : postOrId;
    if (!post) return;

    const weight = feedInteractionWeights[action] ?? 1;
    const signals = getPostInterestSignals(post);
    if (!signals.length) return;

    setInterestScores((current) => {
      const next = { ...current };
      signals.forEach((signal) => {
        next[signal] = Math.min((next[signal] ?? 0) + weight, 1000);
      });
      return next;
    });
  }

  // Feed: cria publicacao com texto/midia, cidade, autor e pontuacao.
  function createFeedPost({ body, media, city, tag }) {
    if (!requireAuthenticatedAction('publicar no feed')) return null;
    const content = body.trim();
    if (!content && !media) return null;
    const postId = `post-${Date.now()}`;
    setFeedPosts((current) => [
      {
        id: postId,
        author: currentUser?.name ?? 'Visitante',
        authorHandle: getUserHandle(currentUser),
        authorEmail: currentUser?.email ?? '',
        role: currentUser?.label ?? 'Membro',
        initials: currentUser?.initials ?? 'MP',
        photo: profilePhoto,
        city: city?.trim() || 'Regional',
        tag: tag || 'Atualização',
        createdAt: getPostTimestamp(),
        body: content,
        likes: 0,
        reactionSummary: { like: 0, love: 0, fire: 0 },
        selectedReaction: '',
        comments: [],
        mediaType: media?.type ?? '',
        mediaName: media?.name ?? '',
        mediaUrl: media?.url ?? '',
        youtubeId: media?.youtubeId ?? '',
        mediaEmbedUrl: media?.embedUrl ?? '',
        mediaThumbnailUrl: media?.thumbnailUrl ?? '',
      },
      ...current,
    ]);
    recordFeedInterest(
      {
        tag: tag || 'Atualização',
        body: content,
        city: city?.trim() || 'Regional',
        author: currentUser?.name ?? 'Visitante',
        role: currentUser?.label ?? 'Membro',
      },
      'publish',
    );
    awardPoints(15, 'publicação no feed');
    return postId;
  }
  // Compartilhar: republica o post no topo do feed preservando origem.
  function shareFeedPost(post) {
    if (!requireAuthenticatedAction('compartilhar publicação')) return null;
    const shareId = `share-${Date.now()}`;
    recordFeedInterest(post, 'share');
    setFeedPosts((current) => [
      {
        id: shareId,
        author: currentUser?.name ?? 'Visitante',
        authorHandle: getUserHandle(currentUser),
        authorEmail: currentUser?.email ?? '',
        role: currentUser?.label ?? 'Membro',
        initials: currentUser?.initials ?? 'MP',
        photo: profilePhoto,
        city: post.city ?? 'Regional',
        tag: 'Compartilhado',
        createdAt: getPostTimestamp(),
        body: post.body,
        likes: 0,
        reactionSummary: { like: 0, love: 0, fire: 0 },
        selectedReaction: '',
        comments: [],
        mediaType: post.mediaType ?? '',
        mediaName: post.mediaName ?? '',
        mediaUrl: post.mediaUrl ?? '',
        youtubeId: post.youtubeId ?? '',
        mediaEmbedUrl: post.mediaEmbedUrl ?? '',
        mediaThumbnailUrl: post.mediaThumbnailUrl ?? '',
        sharedFrom: {
          author: post.author,
          role: post.role,
          city: post.city,
          tag: post.tag,
          createdAt: post.createdAt,
          sharedAt: getPostTimestamp(),
        },
      },
      ...current,
    ]);

    awardPoints(5, 'compartilhamento no feed');
    return shareId;
  }

  // Reacoes: alterna curtir/amei/quente sem abrir a janela de detalhes.
  function reactToFeedPost(postId, reaction) {
    if (!requireAuthenticatedAction('reagir à publicação')) return;
    const currentPost = feedPosts.find((post) => post.id === postId);
    if (currentPost?.selectedReaction !== reaction) {
      recordFeedInterest(currentPost, 'reaction');
    }
    setFeedPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        const previousReaction = post.selectedReaction;
        const reactionSummary = { ...(post.reactionSummary ?? {}) };
        const reactors = (post.reactors ?? []).filter((item) => item.user !== (currentUser?.name ?? 'Visitante'));
        if (previousReaction) {
          reactionSummary[previousReaction] = Math.max((reactionSummary[previousReaction] ?? 1) - 1, 0);
        }
        if (previousReaction !== reaction) {
          reactionSummary[reaction] = (reactionSummary[reaction] ?? 0) + 1;
          reactors.unshift({
            user: currentUser?.name ?? 'Visitante',
            reaction,
            at: getPostTimestamp(),
          });
        }
        return {
          ...post,
          selectedReaction: previousReaction === reaction ? '' : reaction,
          reactionSummary,
          reactors,
        };
      }),
    );
  }

  // Comentarios: adiciona comentario no post e pontua a interacao.
  function commentOnFeedPost(postId, body) {
    if (!requireAuthenticatedAction('comentar no feed')) return null;
    const content = body.trim();
    if (!content) return null;
    recordFeedInterest(postId, 'comment');
    const comment = {
      id: `comment-${Date.now()}`,
      author: currentUser?.name ?? 'Visitante',
      initials: currentUser?.initials ?? getInitials(currentUser?.name ?? 'Visitante'),
      photo: profilePhoto,
      createdAt: getPostTimestamp(),
      body: content,
    };
    setFeedPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...(post.comments ?? []),
                comment,
              ],
            }
          : post,
      ),
    );
    awardPoints(8, 'comentário publicado');
    return comment.id;
  }

  function editFeedPost(postId, nextBody) {
    if (!requireAuthenticatedAction('editar publicação')) return;
    const content = nextBody.trim();
    if (!content) return;
    setFeedPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, body: content, edited: true } : post)),
    );
  }

  function deleteFeedPost(postId) {
    if (!requireAuthenticatedAction('excluir publicação')) return;
    setFeedPosts((current) => current.filter((post) => post.id !== postId));
  }

  function editFeedComment(postId, commentId, nextBody) {
    if (!requireAuthenticatedAction('editar comentário')) return;
    const content = nextBody.trim();
    if (!content) return;
    setFeedPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: (post.comments ?? []).map((comment) =>
                comment.id === commentId ? { ...comment, body: content, edited: true } : comment,
              ),
            }
          : post,
      ),
    );
  }

  function deleteFeedComment(postId, commentId) {
    if (!requireAuthenticatedAction('excluir comentário')) return;
    setFeedPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, comments: (post.comments ?? []).filter((comment) => comment.id !== commentId) }
          : post,
      ),
    );
  }

  // Eventos: cria chamada no feed/comunidade e envia notificacao local.
  function createEventCall(eventData) {
    if (!requireAuthenticatedAction('criar evento')) return;
    const mode = eventData.mode || 'Online';
    const price = Number(eventData.price || 0);
    const capacity = Number(eventData.capacity || 60);
    const event = {
      ...eventData,
      title: eventData.title || 'Chamada de evento',
      type: eventData.type || 'Chamada aberta',
      owner: currentUser?.name ?? 'MeetPoint',
      creatorName: currentUser?.name ?? 'MeetPoint',
      creatorEmail: currentUser?.email ?? '',
      creatorHandle: getUserHandle(currentUser),
      creatorSegment: currentUser?.segment ?? 'local',
      mode,
      location:
        eventData.location?.trim?.() ||
        (mode === 'Presencial' ? 'Local presencial a definir' : 'Sala online MeetPoint'),
      date: eventData.date || '2026-06-20',
      time: eventData.time || '19:00',
      price,
      capacity,
      privacy: eventData.privacy || 'Público',
      registrationRequired: true,
      requiredFields: [
        'name',
        'email',
        'whatsapp',
        ...(eventData.requireDocument ? ['document'] : []),
      ],
      yes: 0,
      no: 0,
      source: 'feed',
      required: false,
    };
    addCommunityEvent(event);
    setNotifications((current) => [
      { id: `notice-${Date.now()}`, title: `Evento publicado: ${event.title}`, channel: 'computador', read: false },
      ...current,
    ]);
  }

  // Eventos: registra participante e cria alerta visível para quem publicou o evento.
  function registerEventAttendance(event, attendeeData) {
    if (!currentUser) {
      requestAuthentication('inscrever-se em evento');
      return {
        ok: false,
        message: 'Entre na conta para confirmar presença neste evento.',
      };
    }

    const eventId = event.id ?? event.title;
    const fullName = attendeeData.fullName.trim();
    const email = attendeeData.email.trim().toLowerCase();
    const whatsapp = attendeeData.whatsapp.trim();
    const documentNumber = attendeeData.documentNumber.trim();
    const requiresDocument = (event.requiredFields ?? []).includes('document');

    if (!fullName || !isValidRealContactEmail(email) || !whatsapp || (requiresDocument && onlyDigits(documentNumber).length < 11)) {
      return {
        ok: false,
        message: requiresDocument
          ? 'Preencha nome, email real, WhatsApp e documento válido para concluir a inscrição.'
          : 'Preencha nome, email real e WhatsApp para concluir a inscrição.',
      };
    }

    const alreadyRegistered = (eventRegistrations[eventId] ?? []).some(
      (registration) =>
        registration.accountEmail === currentUser.email ||
        registration.email.toLowerCase() === email,
    );

    if (alreadyRegistered) {
      return {
        ok: false,
        message: 'Esta conta já está inscrita neste evento.',
      };
    }

    const registration = {
      id: `event-registration-${Date.now()}`,
      eventId,
      fullName,
      email,
      emailMasked: maskEmail(email),
      whatsappMasked: maskPhone(whatsapp),
      documentProvided: Boolean(documentNumber),
      company: attendeeData.company.trim(),
      accountEmail: currentUser.email,
      accountSegment: currentUser.segment,
      registeredAt: getPostTimestamp(),
      paymentStatus: Number(event.price ?? 0) > 0 ? 'Pagamento confirmado no protótipo' : 'Inscrição gratuita confirmada',
    };

    setEventRegistrations((current) => ({
      ...current,
      [eventId]: [registration, ...(current[eventId] ?? [])],
    }));

    setEventCreatorAlerts((current) => [
      {
        id: `event-alert-${Date.now()}`,
        eventId,
        eventTitle: event.title,
        creatorEmail: event.creatorEmail ?? '',
        creatorName: event.creatorName ?? event.owner,
        attendeeName: fullName,
        attendeeEmailMasked: registration.emailMasked,
        createdAt: registration.registeredAt,
        read: false,
      },
      ...current,
    ]);

    setNotifications((current) => [
      {
        id: `notice-event-registration-${Date.now()}`,
        title: `Inscrição confirmada em "${event.title}".`,
        channel: 'computador',
        read: false,
      },
      ...current,
    ]);

    return {
      ok: true,
      registration,
    };
  }

  // Oportunidades: empresa publica vaga, freela, servico, espaco ou parceria.
  function createJob(jobData) {
    if (!requireAuthenticatedAction('criar oportunidade')) return;
    const title = jobData.title.trim();
    const company = jobData.company.trim();
    if (!title || !company) return;
    const category = jobData.category || getOpportunityCategoryFromType(jobData.type);
    const contactMethods = normalizeOpportunityContactMethods({
      type: jobData.type,
      category,
      contactMethods: jobData.contactMethods,
    });

    setJobs((current) => [
      {
        id: `job-${Date.now()}`,
        title,
        company,
        city: jobData.city.trim() || 'Remoto',
        type: jobData.type,
        category,
        salary: jobData.salary.trim() || 'A combinar',
        skills: jobData.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        description: jobData.description?.trim() || 'Descrição completa será informada pela empresa.',
        requirements: jobData.requirements?.trim() || 'Requisitos serão validados pelo RH.',
        benefits: jobData.benefits?.trim() || 'Benefícios serão detalhados no processo seletivo.',
        rhEmail: jobData.rhEmail?.trim() || 'rh@empresa.com',
        whatsapp: jobData.whatsapp?.trim() || '+55 00 00000-0000',
        contactMethods,
        creatorName: currentUser?.name ?? company,
        creatorEmail: currentUser?.email ?? '',
        creatorHandle: getUserHandle(currentUser),
        creatorSegment: currentUser?.segment ?? 'local',
        applicants: 0,
      },
      ...current,
    ]);
    setNotifications((current) => [
      { id: `notice-${Date.now()}`, title: `Nova oportunidade publicada: ${title}`, channel: 'computador', read: false },
      ...current,
    ]);
  }

  // Candidatura: envia curriculo do perfil ou arquivo importado para o RH da vaga.
  function applyToJob(job, resumeName) {
    if (!requireAuthenticatedAction('candidatar-se à oportunidade')) return;
    const notificationEmail = getContactEmail(currentUser);
    setJobApplications((current) =>
      current.some((application) => application.jobId === job.id)
        ? current
        : [
            {
              id: `application-${Date.now()}`,
              jobId: job.id,
              jobTitle: job.title,
              company: job.company,
              candidateName: currentUser?.name ?? 'Visitante',
              candidateEmail: notificationEmail || 'sem-email@local',
              resumeName,
              rhEmail: job.rhEmail,
              status: 'Enviada ao RH',
              createdAt: getPostTimestamp(),
            },
            ...current,
          ],
    );
    if (!jobApplications.some((application) => application.jobId === job.id)) {
      awardPoints(10, 'candidatura enviada');
      setNotifications((current) => [
        {
          id: `notice-application-${Date.now()}`,
          title: `Seu currículo foi enviado ao RH de ${job.company}.`,
          channel: 'email',
          read: false,
        },
        ...current,
      ]);
    }
  }

  // Beneficios: valida assinatura/pontos e simula envio por app, email e WhatsApp.
  function redeemBenefit(benefitId) {
    if (!requireAuthenticatedAction('resgatar benefício')) return;
    const notificationEmail = getContactEmail(currentUser);
    if (!currentUser?.subscriptionActive || !notificationEmail) return;
    const benefit = benefits.find((item) => item.id === benefitId);
    if (!benefit || benefitRedemptions.includes(benefitId) || userPoints < benefit.pointsCost) {
      return;
    }
    const sentAt = new Date().toISOString();
    const delivery = {
      id: `benefit-email-${Date.now()}`,
      benefitId,
      benefitTitle: benefit.title,
      recipientName: currentUser.name,
      recipientEmail: notificationEmail,
      maskedRecipientEmail: maskEmail(notificationEmail),
      subject: benefit.emailSubject ?? `Seu benefício ${benefit.title}`,
      body: benefit.emailBody ?? 'Benefício resgatado na plataforma MeetPoint.',
      assetName: benefit.deliveryAssetName ?? 'beneficio-digital.pdf',
      code: benefit.deliveryCode ?? `MP-${Date.now().toString(36).toUpperCase()}`,
      sentAt,
      status: 'Enviado',
    };
    setBenefitRedemptions((current) => [...current, benefitId]);
    setUserPoints((current) => current - benefit.pointsCost);
    setBenefits((current) =>
      current.map((item) =>
        item.id === benefitId
          ? { ...item, redemptions: item.redemptions + 1 }
          : item,
      ),
    );
    setBenefitEmailDeliveries((current) => [delivery, ...current]);
    setNotifications((current) => [
      {
        id: `notice-benefit-email-${Date.now()}`,
        title: `Benefício "${benefit.title}" enviado para ${maskEmail(notificationEmail)}.`,
        channel: 'email',
        read: false,
      },
      {
        id: `notice-benefit-whatsapp-${Date.now()}`,
        title: `WhatsApp automático preparado com o código ${delivery.code}.`,
        channel: 'celular',
        read: false,
      },
      ...current,
    ]);
  }

  // Admin central: cadastra beneficio que depois sera entregue no resgate.
  function createBenefit(draft) {
    if (!requireAuthenticatedAction('criar benefício')) return null;
    if (currentUser?.segment !== 'platform') return null;
    const title = draft.title.trim();
    const partner = draft.partner.trim();
    const pointsCost = Number(draft.pointsCost || 0);
    if (!title || !partner || pointsCost <= 0) return null;

    const createdBenefit = {
      id: `benefit-${Date.now()}`,
      title,
      partner,
      category: draft.category,
      city: draft.city.trim() || 'Regional',
      pointsCost,
      redemptions: 0,
      emailSubject: draft.emailSubject.trim() || `Seu benefício ${title}`,
      emailBody:
        draft.emailBody.trim() ||
        `Você resgatou ${title}. Use o código enviado para validar o benefício com ${partner}.`,
      deliveryAssetName: draft.deliveryAssetName.trim() || 'beneficio-digital.pdf',
      deliveryCode: draft.deliveryCode.trim() || `MP-${Date.now().toString(36).toUpperCase()}`,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    setBenefits((current) => [createdBenefit, ...current]);
    setNotifications((current) => [
      {
        id: `notice-benefit-created-${Date.now()}`,
        title: `Novo benefício publicado: ${title}.`,
        channel: 'computador',
        read: false,
      },
      ...current,
    ]);
    return createdBenefit;
  }

  function requestBenefitPublication(draft) {
    if (!requireAuthenticatedAction('divulgar benefício')) return null;
    if (['platform', 'employee'].includes(currentUser?.segment)) return null;
    const title = draft.title.trim();
    const partner = draft.partner.trim();
    const product = draft.product.trim();
    const pointsCost = Number(draft.pointsCost || 0);
    if (!title || !partner || !product || pointsCost <= 0) return null;

    const request = {
      id: `benefit-request-${Date.now()}`,
      title,
      partner,
      product,
      category: draft.category,
      city: draft.city.trim() || currentUser?.city || 'Regional',
      pointsCost,
      rules: draft.rules.trim(),
      requesterName: currentUser.name,
      requesterEmail: getContactEmail(currentUser),
      requesterSegment: currentUser.segment,
      status: 'Pendente',
      createdAt: new Date().toISOString(),
    };

    setBenefitRequests((current) => [request, ...current]);
    setNotifications((current) => [
      {
        id: `notice-benefit-request-${Date.now()}`,
        title: `Solicitação enviada para aprovação: ${title}.`,
        channel: 'computador',
        read: false,
      },
      ...current,
    ]);
    return request;
  }

  function approveBenefitRequest(requestId) {
    if (currentUser?.segment !== 'platform') return null;
    const request = benefitRequests.find((item) => item.id === requestId);
    if (!request || request.status !== 'Pendente') return null;

    const approvedBenefit = {
      id: `benefit-${Date.now()}`,
      title: request.title,
      partner: request.partner,
      category: request.category,
      city: request.city || 'Regional',
      pointsCost: Number(request.pointsCost || 0),
      redemptions: 0,
      emailSubject: `Seu benefício ${request.title}`,
      emailBody: request.rules || `Você resgatou ${request.title}. Valide o benefício com ${request.partner}.`,
      deliveryAssetName: 'beneficio-aprovado.pdf',
      deliveryCode: `MP-${Date.now().toString(36).toUpperCase()}`,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      requestedBy: request.requesterName,
      requestId,
    };

    setBenefits((current) => [approvedBenefit, ...current]);
    setBenefitRequests((current) =>
      current.map((item) =>
        item.id === requestId
          ? { ...item, status: 'Aprovado', approvedAt: new Date().toISOString() }
          : item,
      ),
    );
    setNotifications((current) => [
      {
        id: `notice-benefit-approved-${Date.now()}`,
        title: `Benefício aprovado e publicado: ${request.title}.`,
        channel: 'computador',
        read: false,
      },
      ...current,
    ]);
    return approvedBenefit;
  }

  function rejectBenefitRequest(requestId) {
    if (currentUser?.segment !== 'platform') return;
    setBenefitRequests((current) =>
      current.map((item) =>
        item.id === requestId
          ? { ...item, status: 'Reprovado', rejectedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  // Parceiros: registra interesse e direciona para checkout de assinatura.
  function registerPartnerLead(planId) {
    if (!requireAuthenticatedConsent('assinar plano')) return;
    setPartnerLeads((current) =>
      current.includes(planId) ? current : [...current, planId],
    );
    setSelectedPartnerPlanId(planId);
    openPage('subscription-checkout');
  }

  return (
    <main className="platform">
      <header className={headerCompact ? 'topbar compact' : 'topbar'}>
        <button className="brand-button" type="button" onClick={() => openPage('feed')}>
          <span>MP</span>
          MeetPoint
        </button>

        <nav aria-label="Areas principais">
          {visibleNavigation.map((item) => (
            <button
              className={activePage === item.id ? 'active' : ''}
              data-page={item.id}
              key={item.id}
              type="button"
              onClick={() => openPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={currentUser ? 'account-actions signed-in-actions' : 'account-actions guest-actions'}>
          {currentUser && (
            <FloatingNotificationDock
              unreadNotifications={notifications.filter((notice) => !notice.read).length + eventCreatorUnreadCount}
              isOpen={notificationDockOpen}
              onOpenChange={setNotificationDockOpen}
              notifications={notifications}
              eventCreatorAlerts={eventCreatorAlerts}
              setNotifications={setNotifications}
              setEventCreatorAlerts={setEventCreatorAlerts}
            />
          )}
          <button className="account-button" type="button" onClick={() => openPage('profile')}>
            <Avatar initials={currentUser ? getInitials(accountDisplayName) : 'MP'} photo={profilePhoto} />
            <strong className="account-name">{accountDisplayName}</strong>
            {currentUser && <em className="points-inline-badge">{userPoints} pts</em>}
          </button>
          {currentUser ? (
            <button
              className="logout-button"
              type="button"
              onClick={logoutCurrentUser}
            >
              Sair
            </button>
          ) : (
            <button
              className="signup-top-button"
              type="button"
              onClick={() => openPage('profile', { signupChoice: true })}
            >
              Cadastrar
            </button>
          )}
        </div>
      </header>
      {securityWarning && (
        <div className="security-warning-toast" role="alert">
          {securityWarning}
        </div>
      )}

      {visibleNavigation.length > 0 && (
        <nav className="mobile-tabbar mobile-bottom-dock" aria-label="Navegação rápida mobile">
          {primaryMobileNavigation.slice(0, 1).map((item) => (
            <button
              aria-current={activePage === item.id ? 'page' : undefined}
              aria-label={`Ir para ${item.label}`}
              className={activePage === item.id ? 'dock-side-button active' : 'dock-side-button'}
              key={item.id}
              type="button"
              onClick={() => openPage(item.id)}
            >
              <MobileNavIcon name={mobileNavigationIconNames[item.id]} />
              <small>{getMobileTabLabel(item)}</small>
            </button>
          ))}
          <div className="dock-main-pill" role="group" aria-label="Áreas principais">
            {primaryMobileNavigation.slice(1).map((item) => (
              <button
                aria-current={activePage === item.id ? 'page' : undefined}
                aria-label={`Ir para ${item.label}`}
                className={activePage === item.id ? 'dock-item active' : 'dock-item'}
                key={item.id}
                type="button"
                onClick={() => openPage(item.id)}
              >
                <MobileNavIcon name={mobileNavigationIconNames[item.id]} />
                <small>{getMobileTabLabel(item)}</small>
              </button>
            ))}
          </div>
          {(secondaryMobileNavigation.length > 0 || currentUser) && (
            <button
              aria-label="Abrir mais páginas"
              aria-expanded={mobileMoreOpen}
              className={
                secondaryMobileNavigation.some((item) => item.id === activePage)
                  ? 'dock-side-button dock-more-button active mobile-more-trigger'
                  : 'dock-side-button dock-more-button mobile-more-trigger'
              }
              type="button"
              onClick={() => setMobileMoreOpen(true)}
            >
              <MobileNavIcon name="more" />
              <small>Mais</small>
            </button>
          )}
        </nav>
      )}
      {mobileMoreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
          <section className="mobile-more-sheet" onClick={(event) => event.stopPropagation()}>
            <header>
              <strong>Mais páginas</strong>
              <button type="button" onClick={() => setMobileMoreOpen(false)}>
                Fechar
              </button>
            </header>
            <div className="mobile-more-grid">
              {secondaryMobileNavigation.map((item) => (
                <button
                  className={activePage === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => openPage(item.id)}
                >
                  <span aria-hidden="true">
                    <MobileNavIcon name={mobileNavigationIconNames[item.id]} />
                  </span>
                  <strong>{item.label}</strong>
                </button>
              ))}
              {currentUser && (
                <button
                  className="mobile-more-logout"
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    logoutCurrentUser();
                  }}
                >
                  <span aria-hidden="true">
                    <MobileNavIcon name="user" />
                  </span>
                  <strong>Sair</strong>
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <div className={activePage === 'communities' ? 'workspace with-rail' : 'workspace'}>
        {activePage === 'communities' && (
          <CommunitySidePanel
            communities={communities}
            niches={niches}
            activeCommunityId={communityBubbleOpen ? activeCommunityId : ''}
            openCommunity={openCommunity}
            openCommunityCreate={openCommunityCreate}
            toggleFavorite={toggleFavorite}
            addNiche={addNiche}
          />
        )}
        <section
          className={
            activePage === 'communities' && !communityBubbleOpen
              ? 'page-shell community-shell-empty'
              : 'page-shell'
          }
          key={`${activePage}-${motionKey}`}
        >
          {activePage === 'home' && (
            currentUser ? (
              <FeedView
                posts={feedPosts}
                createFeedPost={createFeedPost}
                shareFeedPost={shareFeedPost}
                reactToFeedPost={reactToFeedPost}
                commentOnFeedPost={commentOnFeedPost}
                editFeedPost={editFeedPost}
                deleteFeedPost={deleteFeedPost}
                editFeedComment={editFeedComment}
                deleteFeedComment={deleteFeedComment}
                openPage={openPage}
                currentUser={currentUser}
                profilePhoto={profilePhoto}
                openMediaViewer={openMediaViewer}
                communityEvents={communityEvents}
                jobs={jobs}
                socialGraph={socialGraph}
                interestScores={interestScores}
                recordFeedInterest={recordFeedInterest}
                followProfile={followProfile}
                requestFriendship={requestFriendship}
                resolveFriendship={resolveFriendship}
                blockProfile={blockProfile}
                unblockProfile={unblockProfile}
                openPrivateConversationWithProfile={openPrivateConversationWithProfile}
              />
            ) : (
              <HomeView openPage={openPage} openCourse={openCourse} />
            )
          )}
          {activePage === 'feed' && (
            <FeedView
              posts={feedPosts}
              createFeedPost={createFeedPost}
              shareFeedPost={shareFeedPost}
              reactToFeedPost={reactToFeedPost}
              commentOnFeedPost={commentOnFeedPost}
              editFeedPost={editFeedPost}
              deleteFeedPost={deleteFeedPost}
              editFeedComment={editFeedComment}
              deleteFeedComment={deleteFeedComment}
              openPage={openPage}
              currentUser={currentUser}
              profilePhoto={profilePhoto}
              openMediaViewer={openMediaViewer}
              communityEvents={communityEvents}
              jobs={jobs}
              socialGraph={socialGraph}
              interestScores={interestScores}
              recordFeedInterest={recordFeedInterest}
              followProfile={followProfile}
              requestFriendship={requestFriendship}
              resolveFriendship={resolveFriendship}
              blockProfile={blockProfile}
              unblockProfile={unblockProfile}
              openPrivateConversationWithProfile={openPrivateConversationWithProfile}
            />
          )}
          {activePage === 'courses' && (
            <CoursesView
              courses={catalogCourses}
              selectedCourse={selectedCourse}
              selectedCourseId={selectedCourseId}
              setSelectedCourseId={setSelectedCourseId}
              startCheckout={startCheckout}
              enrollments={enrollments}
              courseProgress={courseProgress}
              createdCourses={createdCourses}
              openPage={openPage}
              openCreatedCourse={openCreatedCourse}
              canPublishCourses={canPublishCourses}
            />
          )}
          {activePage === 'course-create' && (
            canPublishCourses ? (
              <CreateCourseView
                createCourse={createCourse}
                currentUser={currentUser}
                goBack={goBack}
              />
            ) : (
              <AccessGate
                goBack={goBack}
                openPage={openPage}
                title="Publicação restrita"
                description="Para criar curso, entre como Pessoa Física, Pessoa Jurídica, Empresa ou administrador da plataforma."
              />
            )
          )}
          {activePage === 'course-builder' && (
            <CourseBuilderView
              course={createdCourses.find((course) => course.id === editingCreatedCourseId)}
              goBack={goBack}
              openPage={openPage}
              openMediaViewer={openMediaViewer}
              publishCreatedCourse={publishCreatedCourse}
              updateCreatedCourse={updateCreatedCourse}
              updateCreatedCourseModules={updateCreatedCourseModules}
            />
          )}
          {activePage === 'checkout' && (
            <CheckoutView
              course={catalogCourses.find((course) => course.id === checkoutCourseId)}
              finishEnrollment={finishEnrollment}
              goBack={goBack}
              openPage={openPage}
            />
          )}
          {activePage === 'communities' && (
            <CommunitiesView
              communities={communities}
              activeCommunity={activeCommunity}
              profilePhoto={profilePhoto}
              currentUser={currentUser}
              communityBubbleOpen={communityBubbleOpen}
              closeCommunityBubble={() => setCommunityBubbleOpen(false)}
              openPrivateChat={() => setPrivateChatOpen(true)}
              openCommunityCreate={openCommunityCreate}
              showMemberSuggestion={showMemberSuggestion}
              dismissMemberSuggestion={dismissMemberSuggestion}
              addCommunityEvent={addCommunityEvent}
              addCommunityMember={addCommunityMember}
              removeCommunityMember={removeCommunityMember}
              updateCommunityName={updateCommunityName}
              updateCommunityPhoto={updateCommunityPhoto}
              deleteEmptyCommunity={deleteEmptyCommunity}
            />
          )}
          {activePage === 'community-create' && (
            <CreateCommunityView
              createCommunity={createCommunity}
              goBack={goBack}
              niches={niches}
              addNiche={addNiche}
            />
          )}
          {activePage === 'event-create' && (
            canCreateEvents ? (
              <CreateEventCallView
                createEventCall={createEventCall}
                currentUser={currentUser}
                goBack={goBack}
              />
            ) : (
              <AccessGate
                goBack={goBack}
                openPage={openPage}
                title="Criação restrita"
                description="Para publicar eventos, entre como Pessoa Física, Pessoa Jurídica, Empresa ou administrador da plataforma."
              />
            )
          )}
          {activePage === 'events' && (
            <EventsView
              canCreateEvents={canCreateEvents}
              communityEvents={communityEvents}
              currentUser={currentUser}
              eventCreatorAlerts={eventCreatorAlerts}
              eventRegistrations={eventRegistrations}
              openPage={openPage}
              registerEventAttendance={registerEventAttendance}
              requestAuthentication={requestAuthentication}
            />
          )}
          {activePage === 'profile' && (
            <ProfileView
              posts={feedPosts}
              enrollments={enrollments}
              courseProgress={courseProgress}
              coursePaymentStatus={coursePaymentStatus}
              completeLesson={completeLesson}
              profilePhoto={profilePhoto}
              setProfilePhoto={setProfilePhoto}
              currentUser={currentUser}
              authToken={authToken}
              activateUserSession={activateUserSession}
              authMode={authMode}
              setAuthMode={setAuthMode}
              openPage={openPage}
              courses={catalogCourses}
              profileResumeName={profileResumeName}
              setProfileResumeName={setProfileResumeName}
              profilePublicInfo={resolvedProfileInfo}
              setProfilePublicInfo={setProfilePublicInfo}
              userPoints={userPoints}
              notifications={notifications}
              notificationPrefs={notificationPrefs}
              setNotificationPrefs={setNotificationPrefs}
              socialGraph={socialGraph}
              followProfile={followProfile}
              blockProfile={blockProfile}
              unblockProfile={unblockProfile}
              removeFollower={removeFollower}
              acceptIncomingFriendRequest={acceptIncomingFriendRequest}
              rejectIncomingFriendRequest={rejectIncomingFriendRequest}
              communityEvents={communityEvents}
              jobs={jobs}
              benefits={benefits}
              createBenefit={createBenefit}
              benefitRequests={benefitRequests}
              approveBenefitRequest={approveBenefitRequest}
              rejectBenefitRequest={rejectBenefitRequest}
              benefitEmailDeliveries={benefitEmailDeliveries}
              visualPreferences={visualPreferences}
              setVisualPreferences={setVisualPreferences}
              openPrivacyCenter={() => requestPrivacyConsent('consultar termos e privacidade')}
            />
          )}
          {activePage === 'opportunities' && (
            <OpportunitiesView
              jobs={jobs}
              applications={jobApplications}
              applyToJob={applyToJob}
              createJob={createJob}
              profileResumeName={profileResumeName}
              setProfileResumeName={setProfileResumeName}
              profileResumeDetails={profileResumeDetails}
              setProfileResumeDetails={setProfileResumeDetails}
              currentUser={currentUser}
              openPage={openPage}
              requestAuthentication={requestAuthentication}
            />
          )}
          {activePage === 'private-chat' && !['platform', 'employee'].includes(currentUser?.segment) && (
            <PrivateChatWidget
              conversations={privateConversations}
              currentUser={currentUser}
              isOpen
              asPage
              onOpenChange={setPrivateChatOpen}
              onClosePage={() => goBack('feed')}
              socialGraph={socialGraph}
              requestedConversationHandle={requestedPrivateConversation}
              clearRequestedConversation={() => setRequestedPrivateConversation(null)}
              setConversations={setPrivateConversations}
              requirePrivacyConsent={requireAuthenticatedAction}
              openPrivacyCenter={() => requestPrivacyConsent('consultar termos e privacidade')}
            />
          )}
          {activePage === 'benefits' && (
            <BenefitsView
              benefits={benefits}
              redemptions={benefitRedemptions}
              userPoints={userPoints}
              redeemBenefit={redeemBenefit}
              currentUser={currentUser}
              openPage={openPage}
            />
          )}
          {activePage === 'rewards' && (
            <RewardsView
              userPoints={userPoints}
              redemptions={benefitRedemptions}
              benefits={benefits}
              currentUser={currentUser}
              openPage={openPage}
              requestBenefitPublication={requestBenefitPublication}
              benefitRequests={benefitRequests}
            />
          )}
          {activePage === 'partners' && (
            <PartnersView
              leads={partnerLeads}
              registerPartnerLead={registerPartnerLead}
              openPage={openPage}
              openSupport={openSupportChannel}
            />
          )}
          {activePage === 'subscription-checkout' && (
            <SubscriptionCheckoutView
              plan={partnerPlans.find((plan) => plan.id === selectedPartnerPlanId)}
              goBack={goBack}
              openPage={openPage}
              currentUser={currentUser}
              onSubscriptionPending={markSubscriptionPaymentProcessing}
            />
          )}
        </section>
      </div>
      {communityAccessRequest && (
        <CommunityAccessModal
          community={communities.find((item) => item.id === communityAccessRequest.communityId)}
          notice={communityAccessNotice}
          onClose={() => {
            setCommunityAccessRequest(null);
            setCommunityAccessNotice('');
          }}
          onConfirm={confirmCommunityAccess}
        />
      )}
      {authGate && (
        <AuthRequiredModal
          actionLabel={authGate.actionLabel}
          onClose={() => setAuthGate(null)}
          onLogin={() => {
            setAuthGate(null);
            openPage('profile');
          }}
          onSignup={() => {
            setAuthGate(null);
            openPage('profile', { signupChoice: true });
          }}
        />
      )}
      {privacyGate && (
        <PrivacyConsentModal
          actionLabel={privacyGate.actionLabel}
          onAccept={acceptPrivacyConsent}
          onClose={() => setPrivacyGate(null)}
        />
      )}
      {subscriptionGate && (
        <SubscriptionRequiredModal
          actionLabel={subscriptionGate.actionLabel}
          onClose={() => setSubscriptionGate(null)}
          onPlans={() => {
            setSubscriptionGate(null);
            openPage('partners');
          }}
          onCheckout={() => {
            setSubscriptionGate(null);
            openPage('subscription-checkout');
          }}
        />
      )}
      {currentUser && activePage !== 'private-chat' && !['platform', 'employee'].includes(currentUser?.segment) && (
        <PrivateChatWidget
          conversations={privateConversations}
          currentUser={currentUser}
          isOpen={privateChatOpen}
          onOpenChange={setPrivateChatOpen}
          openChatPage={() => openPage('private-chat')}
          socialGraph={socialGraph}
          requestedConversationHandle={requestedPrivateConversation}
          clearRequestedConversation={() => setRequestedPrivateConversation(null)}
          setConversations={setPrivateConversations}
          requirePrivacyConsent={requireAuthenticatedAction}
          openPrivacyCenter={() => requestPrivacyConsent('consultar termos e privacidade')}
        />
      )}
      <SupportWidget
        currentUser={currentUser}
        requestedContext={supportRequestContext}
        clearRequestedContext={() => setSupportRequestContext(null)}
      />
      <MediaViewer viewer={mediaViewer} onClose={closeMediaViewer} />
    </main>
  );
}

function AuthRequiredModal({ actionLabel, onClose, onLogin, onSignup }) {
  return (
    <div className="floating-backdrop" onClick={onClose}>
      <section className="floating-modal auth-required-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <span className="section-kicker">Acesso restrito</span>
        <h3>Crie uma conta para {actionLabel}</h3>
        <p>
          Visitantes podem visualizar Feed, Oportunidades, Eventos e Benefícios. Para interagir,
          enviar dados, salvar, se inscrever, se candidatar ou resgatar benefícios, é necessário
          criar conta, aceitar os termos e concluir o pagamento do plano.
        </p>
        <div className="button-row">
          <button type="button" onClick={onSignup}>Criar conta</button>
          <button className="light" type="button" onClick={onLogin}>Já tenho conta</button>
        </div>
      </section>
    </div>
  );
}

function SubscriptionRequiredModal({ actionLabel, onClose, onPlans, onCheckout }) {
  return (
    <div className="floating-backdrop" onClick={onClose}>
      <section className="floating-modal subscription-required-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <span className="section-kicker">Assinatura necessária</span>
        <h3>Ative um plano para {actionLabel}</h3>
        <p>
          Sua conta já pode navegar pelas áreas públicas, mas ações privadas e áreas
          assinadas só são liberadas depois da confirmação de pagamento pelo gateway.
        </p>
        <div className="subscription-status-panel">
          <strong>Status da conta: pagamento pendente</strong>
          <span>Cadastro → LGPD → plano → checkout → webhook → conta ativa.</span>
        </div>
        <div className="button-row">
          <button type="button" onClick={onPlans}>Escolher plano</button>
          <button className="light" type="button" onClick={onCheckout}>Ir para checkout</button>
        </div>
      </section>
    </div>
  );
}

function PrivacyConsentModal({ actionLabel, onAccept, onClose }) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedDataUse, setAcceptedDataUse] = useState(false);
  const canContinue = acceptedTerms && acceptedPrivacy && acceptedDataUse;

  return (
    <div className="floating-backdrop" onClick={onClose}>
      <section className="floating-modal privacy-consent-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <span className="section-kicker">Privacidade e uso de dados</span>
        <h3>Consentimento necessário</h3>
        <p>
          Para {actionLabel}, a plataforma precisa tratar dados do seu perfil,
          interações, mensagens, inscrições, candidaturas e registros operacionais.
        </p>

        <div className="privacy-consent-sections">
          <details open>
            <summary>Termos de Uso</summary>
            <p>
              Você concorda em usar a plataforma de forma lícita, respeitar outros usuários,
              não publicar conteúdo abusivo e assumir responsabilidade pelas informações enviadas.
            </p>
          </details>
          <details>
            <summary>Política de Privacidade</summary>
            <p>
              Coletamos dados de autenticação, perfil, atividades, comunicações, cursos,
              eventos, oportunidades e benefícios para operar a conta, proteger o sistema e
              registrar ações necessárias à prestação do serviço.
            </p>
          </details>
          <details>
            <summary>Governança LGPD</summary>
            <p>
              O aceite registra versão dos termos, versão da política, data, navegador e
              metadados disponíveis. Você pode solicitar exportação ou exclusão dos dados
              conforme regras legais de retenção e auditoria.
            </p>
          </details>
        </div>

        <p className="policy-note">
          Ao continuar, você autoriza o tratamento dos seus dados para autenticação,
          networking, comunicação interna, oportunidades, eventos, cursos, benefícios,
          marketplace e demais funcionalidades disponibilizadas pela plataforma.
        </p>

        <div className="privacy-consent-checklist">
          <label className="terms-consent-check">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>Li e concordo com os Termos de Uso.</span>
          </label>
          <label className="terms-consent-check">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
            />
            <span>Li e concordo com a Política de Privacidade.</span>
          </label>
          <label className="terms-consent-check">
            <input
              type="checkbox"
              checked={acceptedDataUse}
              onChange={(event) => setAcceptedDataUse(event.target.checked)}
            />
            <span>Autorizo o tratamento dos meus dados conforme a LGPD.</span>
          </label>
        </div>

        <div className="button-row">
          <button className="light" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" disabled={!canContinue} onClick={onAccept}>
            Aceitar e continuar
          </button>
        </div>
        <small>
          Versões: Termos {TERMS_VERSION} · Privacidade {PRIVACY_VERSION}
        </small>
      </section>
    </div>
  );
}

function CommunityAccessModal({ community, notice, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  if (!community) return null;

  const accessMode = getCommunityAccessMode(community);
  const isPasswordProtected = accessMode === 'password';

  return (
    <div className="floating-backdrop" onClick={onClose}>
      <section className="floating-modal community-access-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <span className="section-kicker">Comunidade privada</span>
        <h3>{community.name}</h3>
        <p>{getCommunityAccessLabel(community)}</p>
        {isPasswordProtected ? (
          <form
            className="community-access-form"
            onSubmit={(event) => {
              event.preventDefault();
              onConfirm(password);
            }}
          >
            <label>
              Senha da comunidade
              <input
                autoFocus
                type="password"
                data-protected-password="true"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha enviada pelo administrador"
              />
            </label>
            <button type="submit">Entrar na comunidade</button>
          </form>
        ) : (
          <div className="community-access-form">
            <p>Peça convite ao administrador para conseguir acessar a conversa.</p>
            <button type="button" onClick={() => onConfirm('')}>
              Solicitar convite
            </button>
          </div>
        )}
        {notice && <p className="policy-note">{notice}</p>}
      </section>
    </div>
  );
}

function MediaViewer({ viewer, onClose }) {
  const [scale, setScale] = useState(1);
  const stageRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);

  useEffect(() => {
    if (!viewer) return undefined;
    setScale(1);
    const closeButton = closeButtonRef.current;
    closeButton?.focus?.();

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }
      onClose?.();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [viewer, onClose]);

  if (!viewer) return null;

  function clamp(next) {
    return Math.max(1, Math.min(3, next));
  }

  function toggleFullscreen() {
    const element = stageRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    element.requestFullscreen?.();
  }

  function handleClose() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
    onClose?.();
  }

  const youtubeVideo = viewer.type === 'youtube' ? getYouTubeVideo(viewer.src) : null;
  const youtubeEmbedUrl = youtubeVideo
    ? getInlineYouTubeEmbedUrl(youtubeVideo, { autoplay: true, muted: true })
    : viewer.embedUrl;
  const isVideo = viewer.type === 'video';
  const isYoutube = Boolean(youtubeVideo || viewer.embedUrl);
  const content = (
    <div className="floating-backdrop" onClick={handleClose}>
      <section
        className={`media-viewer ${isYoutube ? 'youtube-viewer' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <strong>{viewer.title ?? 'Mídia'}</strong>
          <div className="media-viewer-actions">
            {!isVideo && !isYoutube && (
              <>
                <button type="button" onClick={() => setScale((current) => clamp(current - 0.25))}>
                  −
                </button>
                <button type="button" onClick={() => setScale(1)}>
                  1:1
                </button>
                <button type="button" onClick={() => setScale((current) => clamp(current + 0.25))}>
                  +
                </button>
              </>
            )}
            <button type="button" onClick={toggleFullscreen}>
              Tela cheia
            </button>
            <button ref={closeButtonRef} type="button" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </header>
        <div className="media-viewer-body">
          <div className="media-stage" ref={stageRef}>
            <div className="media-zoom-surface">
              {isYoutube ? (
                <iframe
                  title={viewer.title ?? 'Vídeo do YouTube'}
                  src={youtubeEmbedUrl}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : isVideo ? (
                <video
                  ref={videoRef}
                  src={viewer.src}
                  controls
                  preload="metadata"
                  playsInline
                  style={{ width: '100%', maxWidth: '100%' }}
                />
              ) : (
                <img
                  src={viewer.src}
                  alt=""
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 160ms var(--motion-smooth)',
                  }}
                />
              )}
            </div>
          </div>
          {viewer.caption && (
            <div className="media-caption">
              <span>{viewer.caption}</span>
              <small>ESC para fechar</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(content, document.body);
}

function YouTubePreviewLink({
  url,
  title = 'Vídeo do YouTube',
  caption = 'Clique ou passe o mouse para reproduzir.',
  openMediaViewer,
  variant = 'inline',
}) {
  const hoverTimerRef = useRef(null);
  const video = getYouTubeVideo(url);

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  if (!video) return null;

  function openPreview() {
    window.clearTimeout(hoverTimerRef.current);
    openMediaViewer?.({
      type: 'youtube',
      src: video.watchUrl,
      embedUrl: video.embedUrl,
      title,
      caption,
    });
  }

  function schedulePreview() {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(openPreview, 320);
  }

  function cancelPreview() {
    window.clearTimeout(hoverTimerRef.current);
  }

  return (
    <button
      className={`youtube-preview-link ${variant}`}
      type="button"
      onClick={openPreview}
      onMouseEnter={schedulePreview}
      onMouseLeave={cancelPreview}
      onFocus={schedulePreview}
      onBlur={cancelPreview}
    >
      {variant === 'card' && <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />}
      <span className="youtube-play-dot">▶</span>
      <span>
        <strong>{title}</strong>
        <small>{video.watchUrl}</small>
      </span>
    </button>
  );
}

function CommunitySidePanel({
  communities,
  niches,
  activeCommunityId,
  openCommunity,
  openCommunityCreate,
  toggleFavorite,
  addNiche,
}) {
  const [filter, setFilter] = useState('Todas');
  const [search, setSearch] = useState('');
  const [customNiche, setCustomNiche] = useState('');

  const filteredCommunities = communities.filter((community) => {
    const matchesFilter = filter === 'Todas' || community.type === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      community.name.toLowerCase().includes(term) ||
      community.topic.toLowerCase().includes(term) ||
      community.type.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  return (
    <aside className="side-panel">
      <button className="create-community" onClick={openCommunityCreate}>
        Criar comunidade
      </button>

      <span className="section-kicker">Procurar e filtrar</span>
      <input
        className="community-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nome, assunto ou nicho"
      />
      <div className="rail-filter">
        {niches.map((item) => (
          <button
            className={filter === item ? 'active' : ''}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="add-niche-row">
        <input
          value={customNiche}
          onChange={(event) => setCustomNiche(event.target.value)}
          placeholder="Adicionar nicho"
        />
        <button
          onClick={() => {
            addNiche(customNiche);
            setFilter(customNiche.trim() || filter);
            setCustomNiche('');
          }}
        >
          +
        </button>
      </div>

      <span className="section-kicker">Comunidades</span>
      <div className="community-list">
        {filteredCommunities.length === 0 ? (
          <article className="empty-state inline-empty-state">
            <strong>Nenhuma comunidade criada ainda.</strong>
            <span>Crie a primeira comunidade para começar conversas, membros e eventos.</span>
          </article>
        ) : filteredCommunities.map((community) => (
          <button
            className={
              activeCommunityId === community.id
                ? `community-item active ${community.color}`
                : `community-item ${community.color}`
            }
            key={community.id}
            onClick={() => openCommunity(community.id)}
          >
            <CommunityAvatar community={community} />
          <div>
            <strong>{community.name}</strong>
            <small>
              {community.type} - {community.members} membros
              {isCommunityPrivate(community) && (
                <span className="community-privacy-pill">🔒 {getCommunityAccessLabel(community)}</span>
              )}
              {community.unread > 0 && (
                <em className="community-unread-badge">
                  {community.unread}
                </em>
              )}
            </small>
          </div>
            <b
              className={community.favorite ? 'favorite active' : 'favorite'}
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(community.id);
              }}
            >
              {community.favorite ? '★' : '☆'}
            </b>
            {community.unread > 0 && <em>{community.unread}</em>}
          </button>
        ))}
      </div>
    </aside>
  );
}

function getNotificationCategory(notice = {}) {
  const text = `${notice.title ?? ''} ${notice.type ?? ''} ${notice.channel ?? ''}`.toLowerCase();
  if (text.includes('ponto') || text.includes('recompensa') || text.includes('+')) return 'Pontuação';
  if (text.includes('candidatura') || text.includes('currículo') || text.includes('vaga') || text.includes('rh')) return 'Oportunidades';
  if (text.includes('evento') || text.includes('inscrição')) return 'Eventos';
  if (text.includes('benefício') || text.includes('beneficio') || text.includes('whatsapp automático')) return 'Benefícios';
  if (text.includes('curso') || text.includes('aula')) return 'Cursos';
  if (text.includes('amizade') || text.includes('seguir') || text.includes('seguidor') || text.includes('comentário')) return 'Social';
  return 'Sistema';
}

function getNotificationIcon(category) {
  const icons = {
    Social: 'S',
    Oportunidades: 'O',
    Eventos: 'E',
    Benefícios: 'B',
    Sistema: '!',
    Pontuação: '+',
    Cursos: 'C',
  };
  return icons[category] ?? '!';
}

function getNotificationPoints(title = '') {
  const [, points] = String(title).match(/\+(\d+)\s*pontos?/i) ?? [];
  return Number(points ?? 0);
}

function groupNotificationItems(items = []) {
  const grouped = [];
  const pointsGroups = new Map();

  items.forEach((item) => {
    if (item.category !== 'Pontuação' || !item.points) {
      grouped.push(item);
      return;
    }

    const reason = item.title.replace(/^\+\d+\s*pontos?:\s*/i, '').trim() || 'atividades recentes';
    const key = `${reason}-${item.read ? 'read' : 'unread'}`;
    const current = pointsGroups.get(key) ?? {
      ...item,
      id: `points-${key}`,
      title: '',
      meta: '',
      count: 0,
      totalPoints: 0,
      reason,
    };
    current.count += 1;
    current.totalPoints += item.points;
    current.read = current.read && item.read;
    pointsGroups.set(key, current);
  });

  pointsGroups.forEach((group) => {
    grouped.push({
      ...group,
      title: group.count > 1
        ? `Você recebeu +${group.totalPoints} pontos por ${group.count} atividades recentes.`
        : `+${group.totalPoints} pontos: ${group.reason}`,
      meta: group.count > 1 ? group.reason : group.meta,
    });
  });

  return grouped.sort((first, second) => Number(first.read) - Number(second.read));
}

function FloatingNotificationDock({
  unreadNotifications,
  isOpen,
  onOpenChange,
  notifications,
  eventCreatorAlerts,
  setNotifications,
  setEventCreatorAlerts,
}) {
  const dockRef = React.useRef(null);
  const rawNotificationItems = [
    ...(notifications ?? []).map((notice) => ({
      id: notice.id,
      title: notice.title,
      meta: notice.actorHandle
        ? `${getSocialProfileByHandle(notice.actorHandle)?.name ?? notice.actorHandle} • ${notice.channel}`
        : `Canal: ${notice.channel}`,
      read: notice.read,
      category: getNotificationCategory(notice),
      icon: getNotificationIcon(getNotificationCategory(notice)),
      points: getNotificationPoints(notice.title),
    })),
    ...(eventCreatorAlerts ?? []).map((alert) => ({
      id: alert.id,
      title: alert.title ?? 'Nova inscrição em evento.',
      meta: alert.eventTitle
        ? `${alert.eventTitle} • ${alert.attendeeName ?? 'Participante'}`
        : 'Eventos',
      read: alert.read,
      category: 'Eventos',
      icon: getNotificationIcon('Eventos'),
      points: 0,
    })),
  ];
  const notificationItems = groupNotificationItems(rawNotificationItems);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (dockRef.current?.contains(event.target)) return;
      onOpenChange(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen, onOpenChange]);

  function markAllRead() {
    setNotifications((current) => current.map((notice) => ({ ...notice, read: true })));
    setEventCreatorAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
  }

  return (
    <aside className={isOpen ? 'floating-notification-widget open' : 'floating-notification-widget'} ref={dockRef}>
      {isOpen && (
        <section className="notification-dock-window" aria-label="Notificações">
          <header>
            <div>
              <span className="section-kicker">Notificações</span>
              <strong>Atualizações recentes</strong>
            </div>
            {unreadNotifications > 0 && <em>{unreadNotifications} não lida(s)</em>}
            <button type="button" onClick={markAllRead}>
              Marcar lidas
            </button>
          </header>
          <div className="notification-dock-list">
            {notificationItems.length === 0 ? (
              <p className="empty-state">Nenhuma notificação no momento.</p>
            ) : notificationItems.map((item) => (
              <article className={item.read ? '' : 'unread'} key={item.id}>
                <span>{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <b>{item.category}</b>
                  <small>{item.meta}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <button
        className={unreadNotifications > 0 && !isOpen ? 'floating-notification-fab has-unread' : 'floating-notification-fab'}
        type="button"
        onClick={() => onOpenChange((current) => !current)}
        aria-label="Abrir notificações"
      >
        🔔
        {unreadNotifications > 0 && <em>{unreadNotifications}</em>}
      </button>
    </aside>
  );
}

function PrivateChatWidget({
  conversations,
  currentUser,
  isOpen,
  asPage = false,
  onOpenChange,
  onClosePage,
  openChatPage,
  socialGraph,
  requestedConversationHandle,
  clearRequestedConversation,
  setConversations,
  requirePrivacyConsent,
  openPrivacyCenter,
}) {
  const widgetRef = React.useRef(null);
  const [activeConversationId, setActiveConversationId] = useState(conversations[0]?.id ?? '');
  const [conversationTab, setConversationTab] = useState('main');
  const [draft, setDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);
  const peopleResults = socialProfiles.filter((profile) =>
    profile.name.toLowerCase().includes(query.trim().toLowerCase()) ||
    profile.handle.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const primaryConversationHandles = uniqueItems([
    ...(socialGraph?.friendHandles ?? []),
    ...(socialGraph?.followingHandles ?? []),
  ]);
  const isPrimaryConversation = (conversation) =>
    primaryConversationHandles.includes(conversation.participantHandle);
  const primaryConversations = conversations.filter(isPrimaryConversation);
  const otherConversations = conversations.filter((conversation) => !isPrimaryConversation(conversation));
  const visibleConversations = conversationTab === 'main' ? primaryConversations : otherConversations;
  const activeConversationVisible = visibleConversations.some((conversation) => conversation.id === activeConversation?.id);
  const chatIsVisible = asPage || isOpen;

  useEffect(() => {
    if (!chatIsVisible || asPage) return undefined;

    function closeOnOutsideClick(event) {
      if (widgetRef.current?.contains(event.target)) return;
      onOpenChange(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [chatIsVisible, asPage, onOpenChange]);

  useEffect(() => {
    if (!chatIsVisible || !requestedConversationHandle) return;
    const requestedConversation = conversations.find(
      (conversation) => conversation.participantHandle === requestedConversationHandle,
    );
    if (!requestedConversation) return;
    const nextTab = isPrimaryConversation(requestedConversation) ? 'main' : 'others';
    setConversationTab(nextTab);
    openConversation(requestedConversation.id);
    clearRequestedConversation?.();
  }, [chatIsVisible, requestedConversationHandle, conversations]);

  useEffect(() => {
    if (!chatIsVisible || activeConversationVisible) return;
    const nextConversation = visibleConversations[0];
    if (nextConversation) {
      setActiveConversationId(nextConversation.id);
    }
  }, [chatIsVisible, conversationTab, visibleConversations.length, activeConversationVisible]);

  function openConversation(conversationId) {
    setActiveConversationId(conversationId);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation,
      ),
    );
  }

  function startConversation(profile) {
    const existing = conversations.find((conversation) => conversation.participantId === profile.id);
    if (existing) {
      setConversationTab(isPrimaryConversation(existing) ? 'main' : 'others');
      openConversation(existing.id);
      setSearchOpen(false);
      return;
    }

    const nextConversation = {
      id: `conversation-${profile.id}`,
      participantId: profile.id,
      participantName: profile.name,
      participantHandle: profile.handle,
      participantInitials: profile.initials,
      participantPhoto: profile.photo,
      unread: 0,
      messages: [],
    };
    setConversations((current) => [nextConversation, ...current]);
    setActiveConversationId(nextConversation.id);
    setConversationTab(isPrimaryConversation(nextConversation) ? 'main' : 'others');
    setSearchOpen(false);
  }

  function sendMessage(event) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || !activeConversation) return;
    if (!requirePrivacyConsent?.('enviar mensagem privada')) return;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: `private-${Date.now()}`,
                  from: currentUser.name,
                  body,
                  time,
                  mine: true,
                },
              ],
            }
          : conversation,
      ),
    );
    setDraft('');
  }

  function handleFabClick() {
    if (openChatPage && window.matchMedia('(max-width: 760px)').matches) {
      openChatPage();
      return;
    }
    onOpenChange((current) => !current);
  }

  function closeChat() {
    if (asPage) {
      onClosePage?.();
      return;
    }
    onOpenChange(false);
  }

  return (
    <aside className={`${chatIsVisible ? 'private-chat-widget open' : 'private-chat-widget'}${asPage ? ' as-page' : ''}`} ref={widgetRef}>
      {chatIsVisible && (
        <section className="private-chat-window" aria-label="Conversas privadas">
          <header>
            {asPage && (
              <button className="private-chat-back-button" type="button" onClick={closeChat}>
                Voltar
              </button>
            )}
            <div>
              <span className="section-kicker">Mensagens</span>
              <strong>Conversas privadas</strong>
            </div>
            <div className="private-chat-window-actions">
              <button type="button" aria-label="Pesquisar pessoas" onClick={() => setSearchOpen((current) => !current)}>
                ⌕
              </button>
              <button type="button" onClick={openPrivacyCenter}>Privacidade</button>
              <button type="button" onClick={closeChat}>Fechar</button>
            </div>
          </header>

          {searchOpen && (
            <section className="private-search-panel">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar pessoa por nome"
                autoFocus
              />
              <div>
                {peopleResults.slice(0, 5).map((profile) => (
                  <button key={profile.id} type="button" onClick={() => startConversation(profile)}>
                    <Avatar initials={profile.initials} photo={profile.photo} />
                    <span>
                      <strong>{profile.name}</strong>
                      <small>{profile.handle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="private-chat-tabs">
            <button
              className={conversationTab === 'main' ? 'private-chat-tab-button active' : 'private-chat-tab-button'}
              type="button"
              onClick={() => setConversationTab('main')}
            >
              Principal <span>{primaryConversations.length}</span>
            </button>
            <button
              className={conversationTab === 'others' ? 'private-chat-tab-button active' : 'private-chat-tab-button'}
              type="button"
              onClick={() => setConversationTab('others')}
            >
              Demais <span>{otherConversations.length}</span>
            </button>
          </div>

          {!activeConversation || !activeConversationVisible || !visibleConversations.length ? (
            <p className="empty-state">
              {conversationTab === 'main'
                ? 'Nenhuma conversa com amigos ou perfis seguidos.'
                : 'Nenhuma mensagem de pessoas fora da sua rede.'}
            </p>
          ) : (
            <div className="private-chat-grid">
              <div className="private-conversation-list">
                {visibleConversations.map((conversation) => {
                  const lastMessage = conversation.messages.at(-1);
                  return (
                    <button
                      className={activeConversation.id === conversation.id ? 'private-conversation-button active' : 'private-conversation-button'}
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation.id)}
                    >
                      <Avatar initials={conversation.participantInitials} photo={conversation.participantPhoto} />
                      <span className="private-conversation-summary">
                        <strong className="private-conversation-name">{conversation.participantName}</strong>
                        <bdi className="private-conversation-preview">{lastMessage?.body ?? 'Nova conversa privada'}</bdi>
                      </span>
                      {conversation.unread > 0 && <em>{conversation.unread}</em>}
                    </button>
                  );
                })}
              </div>

              <section className="private-thread">
                <div className="private-thread-head">
                  <Avatar
                    initials={activeConversation.participantInitials}
                    photo={activeConversation.participantPhoto}
                  />
                  <div>
                    <strong>{activeConversation.participantName}</strong>
                    <small>{activeConversation.participantHandle}</small>
                  </div>
                </div>
                <div className="private-thread-messages">
                  {activeConversation.messages.map((message) => (
                    <p className={message.mine ? 'mine' : ''} key={message.id}>
                      <span>{message.body}</span>
                      <small>{message.time}</small>
                    </p>
                  ))}
                </div>
                <form className="private-thread-form" onSubmit={sendMessage}>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
                      event.preventDefault();
                      sendMessage(event);
                    }}
                    placeholder="Mensagem privada"
                  />
                  <button type="submit">Enviar</button>
                </form>
              </section>
            </div>
          )}
        </section>
      )}
      {!asPage && (
        <button className="private-chat-fab" type="button" onClick={handleFabClick} aria-label="Abrir conversas privadas">
          💬
          {unreadTotal > 0 && <em>{unreadTotal}</em>}
        </button>
      )}
    </aside>
  );
}

function classifySupportRequest(message) {
  const text = message.toLowerCase();
  const criticalTerms = ['fraude', 'vazamento', 'invad', 'jurid', 'processo', 'violencia', 'assedio', 'banir', 'bloqueio'];
  const highTerms = ['pagamento', 'pix', 'boleto', 'cartao', 'cartão', 'cobranca', 'cobrança', 'reembolso', 'cpf', 'rg', 'cnpj', 'documento', 'erro', 'bug'];
  const mediumTerms = ['perfil', 'curso', 'evento', 'oportunidade', 'comunidade', 'beneficio', 'benefício', 'mensagem'];

  if (criticalTerms.some((term) => text.includes(term))) {
    return { category: 'Critico', priority: 'CRITICAL', shouldEscalate: true };
  }

  if (highTerms.some((term) => text.includes(term))) {
    return { category: 'Operacional sensivel', priority: 'HIGH', shouldEscalate: true };
  }

  if (mediumTerms.some((term) => text.includes(term))) {
    return { category: 'Uso da plataforma', priority: 'MEDIUM', shouldEscalate: false };
  }

  return { category: 'Duvida geral', priority: 'LOW', shouldEscalate: false };
}

function summarizeSupportConversation(conversation, nextMessage = '') {
  return [...conversation, ...(nextMessage ? [{ from: 'user', body: nextMessage }] : [])]
    .slice(-8)
    .map((item) => `${item.from}: ${item.body}`)
    .join('\n')
    .slice(0, 1800);
}

function SupportWidget({ currentUser, requestedContext, clearRequestedContext }) {
  const widgetRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const handledRequestRef = React.useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('ai');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('Sugestão de melhoria');
  const [status, setStatus] = useState('');
  const [conversation, setConversation] = useState([
    {
      from: 'ai',
      body: 'Sou a IA de suporte da MeetPoint. Primeiro tento resolver por aqui; se for caso sensivel ou nao resolvido, abro um ticket humano com o historico completo.',
    },
  ]);

  const requester = {
    name: currentUser?.name,
    email: currentUser?.email,
    segment: currentUser?.label,
  };

  function createLocalHumanTicket(reason, context = {}) {
    const classification = context.classification ?? classifySupportRequest(reason);
    const ticketId = `MP-SUP-${Date.now().toString(36).toUpperCase()}`;
    const ticket = {
      id: ticketId,
      reason,
      requester,
      category: classification.category,
      priority: classification.priority,
      conversationSummary: context.conversationSummary ?? summarizeSupportConversation(conversation, reason),
      attempts: context.attempts ?? ['ai'],
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      channel: 'human',
    };

    try {
      const savedTickets = JSON.parse(localStorage.getItem('localSupportTickets') ?? '[]');
      localStorage.setItem('localSupportTickets', JSON.stringify([ticket, ...savedTickets]));
    } catch {
      // Se o navegador bloquear storage, a conversa ainda mostra o protocolo da sessão.
    }

    return ticketId;
  }

  useEffect(() => {
    if (!requestedContext || handledRequestRef.current === requestedContext.id) return;

    handledRequestRef.current = requestedContext.id;
    setIsOpen(true);
    setMode(requestedContext.mode ?? 'ai');
    setStatus(requestedContext.status ?? 'Suporte aberto pela IA.');

    if (requestedContext.subject) setSubject(requestedContext.subject);
    if (requestedContext.prefill) setMessage(requestedContext.prefill);
    if (requestedContext.notice) {
      setConversation((current) => [
        ...current,
        { from: 'support', body: requestedContext.notice },
      ]);
    }

    window.requestAnimationFrame(() => textareaRef.current?.focus());
    clearRequestedContext?.();
  }, [requestedContext]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (widgetRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  function localSupportAnswer(text) {
    const classification = classifySupportRequest(text);
    if (classification.shouldEscalate) {
      return 'Esse caso precisa de atendimento humano porque envolve dados, pagamento, seguranca, erro critico ou solicitacao administrativa. Vou abrir um ticket com o contexto desta conversa.';
    }

    const normalized = text.toLowerCase();
    if (normalized.includes('senha')) {
      return 'Para recuperar senha, entre no login e clique em Esqueci a senha. Se errar 3 vezes, o sistema também mostra uma notificação de recuperação.';
    }
    if (normalized.includes('curso') || normalized.includes('aula')) {
      return 'Para cursos, acesse Cursos, escolha um curso e se inscreva. Depois ele aparece no perfil; aulas só avançam quando a ação exigida pelo produtor for concluída.';
    }
    if (normalized.includes('pagamento') || normalized.includes('pix') || normalized.includes('boleto') || normalized.includes('cartão')) {
      return 'Pagamentos sensíveis precisam de suporte humano. Vou deixar essa conversa marcada para atendimento da equipe.';
    }
    if (normalized.includes('comunidade')) {
      return 'Na aba Comunidades você pode buscar grupos, entrar, favoritar, conversar, sugerir eventos e criar comunidade se tiver permissão.';
    }
    if (normalized.includes('perfil')) {
      return 'No Perfil você acompanha cursos, progresso, comunidades, documentos e dados da conta. Alterações sensíveis como CPF/RG exigem verificação.';
    }
    return 'Consigo ajudar com login, cursos, comunidades, eventos, oportunidades e perfil. Se a resposta nao resolver, eu encaminho para uma pessoa com o historico da conversa.';
  }

  async function sendSupportMessage(event) {
    event?.preventDefault();
    if (!message.trim()) return;

    const userMessage = message.trim();
    const classification = classifySupportRequest(userMessage);
    const conversationSummary = summarizeSupportConversation(conversation, userMessage);
    setConversation((current) => [...current, { from: 'user', body: userMessage }]);
    setMessage('');
    setStatus('IA analisando solicitacao...');

    try {
      if (mode === 'suggestion') {
        const result = await supportRequest('/suggestions', {
          method: 'POST',
          body: JSON.stringify({
            subject,
            message: userMessage,
            category: classification.category,
            priority: classification.priority,
            conversationSummary,
            ...requester,
          }),
        });
        setConversation((current) => [
          ...current,
          { from: 'support', body: `${result.message} Ticket: ${result.ticketId}` },
        ]);
        setStatus('Sugestão registrada.');
        return;
      }

      const result = await supportRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: mode === 'human' ? `Quero falar com uma pessoa. ${userMessage}` : userMessage,
          preferredChannel: mode,
          category: classification.category,
          priority: mode === 'human' ? 'HIGH' : classification.priority,
          conversationSummary,
          ...requester,
        }),
      });
      setConversation((current) => [
        ...current,
        {
          from: result.mode === 'ai' ? 'ai' : 'support',
          body: result.ticketId ? `${result.answer} Ticket: ${result.ticketId}` : result.answer,
        },
      ]);
      setStatus(result.escalated ? 'Atendimento humano acionado.' : 'Respondido pela IA.');

      if (mode === 'ai' && classification.shouldEscalate && !result.escalated) {
        const ticketId = createLocalHumanTicket(userMessage, { classification, conversationSummary });
        setConversation((current) => [
          ...current,
          {
            from: 'support',
            body: `Classifiquei como ${classification.category} (${classification.priority}) e abri atendimento humano com o historico. Protocolo local: ${ticketId}.`,
          },
        ]);
        setStatus(`Escalado para humano. Protocolo ${ticketId}.`);
      }
    } catch {
      if (mode === 'suggestion') {
        setConversation((current) => [
          ...current,
          {
            from: 'support',
            body: 'Sua sugestão ficou registrada localmente neste protótipo. Quando a API estiver conectada, ela será enviada para a central.',
          },
        ]);
        setStatus('Sugestão guardada localmente.');
        return;
      }

      if (mode === 'human') {
        const ticketId = createLocalHumanTicket(userMessage, {
          classification: { ...classification, priority: 'HIGH' },
          conversationSummary,
          attempts: ['human-request'],
        });
        setConversation((current) => [
          ...current,
          {
            from: 'support',
            body: `Atendimento humano aberto no protótipo. Protocolo: ${ticketId}. A equipe visualiza esse fluxo na central quando o banco estiver conectado.`,
          },
        ]);
        setStatus(`Atendimento humano acionado. Protocolo ${ticketId}.`);
        return;
      }

      if (classification.shouldEscalate) {
        const ticketId = createLocalHumanTicket(userMessage, { classification, conversationSummary });
        setConversation((current) => [
          ...current,
          {
            from: 'ai',
            body: localSupportAnswer(userMessage),
          },
          {
            from: 'support',
            body: `Ticket humano aberto com categoria ${classification.category} e prioridade ${classification.priority}. Protocolo: ${ticketId}.`,
          },
        ]);
        setStatus(`Escalado para humano. Protocolo ${ticketId}.`);
        return;
      }

      setConversation((current) => [
        ...current,
        {
          from: 'ai',
          body: localSupportAnswer(userMessage),
        },
      ]);
      setStatus('Respondido por fallback local.');
    }
  }

  async function escalateToHuman() {
    const escalationMessage = message.trim()
      || 'A IA não resolveu minha dúvida. Quero falar com uma pessoa do suporte.';
    const classification = classifySupportRequest(escalationMessage);
    const conversationSummary = summarizeSupportConversation(conversation, escalationMessage);

    setMode('human');
    setMessage('');
    setStatus('Acionando atendimento humano...');
    setConversation((current) => [
      ...current,
      {
        from: 'user',
        body: 'Não resolveu. Quero falar com uma pessoa do suporte.',
      },
    ]);

    try {
      const result = await supportRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: `Quero falar com uma pessoa. ${escalationMessage}`,
          preferredChannel: 'human',
          category: classification.category,
          priority: classification.priority === 'LOW' ? 'MEDIUM' : classification.priority,
          conversationSummary,
          ...requester,
        }),
      });

      setConversation((current) => [
        ...current,
        {
          from: 'support',
          body: result.ticketId ? `${result.answer} Ticket: ${result.ticketId}` : result.answer,
        },
      ]);
      setStatus('Atendimento humano acionado.');
    } catch {
      const ticketId = createLocalHumanTicket(escalationMessage, {
        classification: {
          ...classification,
          priority: classification.priority === 'LOW' ? 'MEDIUM' : classification.priority,
        },
        conversationSummary,
        attempts: ['ai', 'manual-escalation'],
      });
      setConversation((current) => [
        ...current,
        {
          from: 'support',
          body: `Atendimento humano aberto no protótipo. Protocolo: ${ticketId}. Com o banco conectado, este fluxo passa a criar ticket real na central.`,
        },
      ]);
      setStatus(`Atendimento humano acionado. Protocolo ${ticketId}.`);
    }
  }

  return (
    <aside className={isOpen ? 'support-widget open' : 'support-widget'} ref={widgetRef}>
      {isOpen && (
        <section className="support-panel">
          <header>
            <div>
              <span className="section-kicker">Suporte</span>
              <strong>Assistente IA da plataforma</strong>
            </div>
            <button className="support-close-button" type="button" onClick={() => setIsOpen(false)}>Fechar</button>
          </header>

          <div className="support-mode-tabs">
            <button type="button" className={mode === 'ai' ? 'support-mode-button active' : 'support-mode-button'} onClick={() => setMode('ai')}>IA primeiro</button>
            <button type="button" className={mode === 'human' ? 'support-mode-button active' : 'support-mode-button'} onClick={() => setMode('human')}>Escalar</button>
            <button type="button" className={mode === 'suggestion' ? 'support-mode-button active' : 'support-mode-button'} onClick={() => setMode('suggestion')}>Sugestão</button>
          </div>

          <p className="support-ai-note">
            A IA resolve duvidas simples. Casos sensiveis viram ticket com categoria, prioridade e historico.
          </p>

          {mode === 'suggestion' && (
            <label>
              Assunto
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
          )}

          <div className="support-thread">
            {conversation.map((item, index) => (
              <p className={item.from === 'user' ? 'from-user' : 'from-support'} key={`${item.from}-${index}`}>
                {item.body}
              </p>
            ))}
          </div>

          <form className="support-form" onSubmit={sendSupportMessage}>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                mode === 'suggestion'
                  ? 'Descreva o que você quer melhorar na plataforma'
                  : mode === 'human'
                    ? 'Descreva o problema para escalar com contexto'
                    : 'Pergunte para a IA de suporte'
              }
            />
            <button className="support-submit-button" type="submit">
              {mode === 'suggestion' ? 'Enviar sugestão' : mode === 'human' ? 'Abrir ticket' : 'Perguntar IA'}
            </button>
          </form>
          {mode === 'ai' && (
            <button className="support-escalate-button" type="button" onClick={escalateToHuman}>
              Não resolveu? Chamar pessoa
            </button>
          )}
          {status && <small>{status}</small>}
        </section>
      )}
      <button className="support-fab" type="button" aria-label="Abrir suporte" onClick={() => setIsOpen((current) => !current)}>
        Suporte
      </button>
    </aside>
  );
}

function getValidPageIds() {
  return new Set([
    ...navigation.map((item) => item.id),
    'private-chat',
    'checkout',
    'subscription-checkout',
    'course-create',
    'course-builder',
    'community-create',
    'event-create',
  ]);
}

function buildRouteState(pageId, options = {}) {
  const validPages = getValidPageIds();
  const page = validPages.has(pageId) ? pageId : 'home';
  const signupSegment =
    page === 'profile' && options.signupSegment
      ? options.signupSegment
      : null;
  const signupValue = signupSegment
    ? getSignupRouteValue(signupSegment)
    : page === 'profile' && options.signupChoice
      ? 'escolha'
      : null;
  const url = options.url ? new URL(options.url) : new URL(window.location.href);

  url.searchParams.set('page', page);
  if (signupValue) {
    url.searchParams.set('signup', signupValue);
  } else {
    url.searchParams.delete('signup');
  }

  return {
    page,
    signupMode: Boolean(signupValue),
    signupSegment,
    url,
    historyState: {
      page,
      ...(signupValue ? { signup: signupValue } : {}),
    },
  };
}

function getCurrentRouteState(historyState = {}) {
  const url = new URL(window.location.href);
  const rawPage = historyState?.page ?? url.searchParams.get('page') ?? 'home';
  const signupParam = rawPage === 'profile' ? url.searchParams.get('signup') : null;
  const signupSegment = getSignupSegmentFromUrl(url);
  return buildRouteState(rawPage, {
    signupSegment,
    signupChoice: Boolean(signupParam) && !signupSegment,
    url,
  });
}

function isPublicDomainEntry(url = new URL(window.location.href)) {
  return !url.searchParams.has('page') && !url.searchParams.has('signup');
}

function getSignupSegmentFromUrl(url = new URL(window.location.href)) {
  const signup = url.searchParams.get('signup');
  if (signup === 'pf') return 'pf';
  if (signup === 'pj') return 'pj';
  if (signup === 'empresa' || signup === 'company') return 'company';
  return null;
}

function getSignupRouteValue(segment) {
  if (segment === 'company') return 'empresa';
  return segment;
}

function getLockedRoute() {
  if (typeof localStorage === 'undefined') return '';
  const value = localStorage.getItem(ROUTE_LOCK_KEY) ?? '';
  return value === 'subscription-checkout' ? value : '';
}

function setLockedRoute(pageId) {
  if (typeof localStorage === 'undefined') return;
  if (pageId === 'subscription-checkout') {
    localStorage.setItem(ROUTE_LOCK_KEY, pageId);
    return;
  }
  localStorage.removeItem(ROUTE_LOCK_KEY);
}

function HomeView({ openPage, openCourse }) {
  const homeFeatures = [
    { id: 'feed', color: 'blue', label: 'Feed', title: 'Posts, fotos, vídeos e autoridade regional' },
    { id: 'courses', color: 'pink', label: 'Cursos', title: 'Conteúdo gratuito, pago, aulas e materiais' },
    { id: 'communities', color: 'yellow', label: 'Comunidades', title: 'Grupos por cidade, tema ou interesse' },
    { id: 'opportunities', color: 'blue', label: 'Oportunidades', title: 'Vagas, freelas, serviços e parcerias' },
    { id: 'benefits', color: 'yellow', label: 'Benefícios', title: 'Cupons e recompensas para assinantes' },
    { id: 'partners', color: 'pink', label: 'Parceiros', title: 'Planos, patrocínio e afiliados' },
  ];

  return (
    <>
      <section className="hero-banner home-hero">
        <div className="hero-copy">
          <span className="capsule">MeetPoint</span>
          <h1>Comunidade, conteúdo e negócios locais em uma só plataforma.</h1>
          <p>
            Feed social, comunidades, cursos, oportunidades, eventos, benefícios,
            pontos e parceiros com uma navegação simples.
          </p>
          <div className="home-hero-actions">
            <button onClick={() => openPage('profile')}>Entrar</button>
            <button className="light" onClick={() => openPage('profile', { signupChoice: true })}>
              Cadastrar
            </button>
            <button className="ghost" onClick={() => openPage('feed')}>
              Explorar feed
            </button>
          </div>
        </div>

        <div className="hero-stack" aria-label="Atalhos principais">
          {initialCourses.length === 0 ? (
            <article className="stack-card yellow empty-stack-card">
              <span>Primeiro uso</span>
              <strong>Sem cursos publicados</strong>
            </article>
          ) : initialCourses.map((course) => (
            <button
              className={`stack-card ${course.color}`}
              key={course.id}
              onClick={() => openCourse(course.id)}
            >
              <span>{course.tag}</span>
              <strong>{course.isFree ? 'Grátis' : `R$ ${course.price}`}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="home-grid home-compact-grid">
        <section className="spotlight-card home-summary-card">
          <span className="section-kicker">Visão geral</span>
          <h2>Entrada rápida para tudo que movimenta a comunidade.</h2>
          <p>
            A Home resume o que está em alta e leva direto para as áreas principais,
            sem expor formulários ou painéis pesados logo na primeira tela.
          </p>
          <div className="home-summary-metrics">
            <article><strong>3</strong><span>posts em destaque</span></article>
            <article><strong>5</strong><span>vagas e negócios</span></article>
            <article><strong>4</strong><span>eventos ativos</span></article>
          </div>
        </section>

        {homeFeatures.map((feature) => (
          <button
            className={`mini-card compact-home-card ${feature.color}`}
            key={feature.id}
            onClick={() => openPage(feature.id)}
          >
            <span>{feature.label}</span>
            <strong>{feature.title}</strong>
          </button>
        ))}
      </div>

      <section className="home-flow-strip">
        <article>
          <span className="section-kicker">Agora</span>
          <strong>Eventos próximos</strong>
          <p>Aulas, lives e networking com confirmação.</p>
          <button onClick={() => openPage('events')}>Abrir agenda</button>
        </article>
        <article>
          <span className="section-kicker">Valor</span>
          <strong>Benefícios</strong>
          <p>Cupons liberados por assinatura ou pontos.</p>
          <button onClick={() => openPage('benefits')}>Ver benefícios</button>
        </article>
        <article>
          <span className="section-kicker">Carreira</span>
          <strong>Oportunidades</strong>
          <p>Vagas, serviços, espaços e parcerias.</p>
          <button onClick={() => openPage('opportunities')}>Buscar vagas</button>
        </article>
        <article>
          <span className="section-kicker">Suporte</span>
          <strong>IA + pessoa</strong>
          <p>Triagem automática e atendimento humano.</p>
          <button onClick={() => openPage('profile')}>Ver conta</button>
        </article>
      </section>

      <section className="suggestion-grid home-insight-strip">
        <article>
          <span className="section-kicker">Entrada</span>
          <h3>Painel vivo</h3>
          <p>Novidades, parceiros e avisos em cards curtos.</p>
        </article>
        <article>
          <span className="section-kicker">Monetização</span>
          <h3>Assinatura e vendas</h3>
          <p>PF, PJ, empresas, patrocinadores e afiliados.</p>
        </article>
        <article>
          <span className="section-kicker">Engajamento</span>
          <h3>Pontos e recompensas</h3>
          <p>Ações úteis aumentam pontuação e resgates.</p>
        </article>
      </section>
    </>
  );
}

const feedReactions = [
  { id: 'like', icon: '👍', label: 'Curtir' },
  { id: 'love', icon: '💛', label: 'Amei' },
  { id: 'fire', icon: '🔥', label: 'Quente' },
  { id: 'clap', icon: '👏', label: 'Aplauso' },
];

function getSocialProfileByName(name) {
  return socialProfiles.find((profile) => profile.name === name);
}

function getUserHandle(user) {
  if (!user?.name) return '@visitante';
  return `@${user.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 22)}`;
}

function getFeedPriority(post, followingHandles, interests, interestScores = {}) {
  const profile = getSocialProfileByName(post.author);
  const isFollowing = Boolean(profile && followingHandles.includes(profile.handle));
  const haystack = `${post.tag} ${post.body} ${post.role}`.toLowerCase();
  const hasBaseInterest = interests.some((interest) => haystack.includes(interest.toLowerCase()));
  const adaptiveScore = getPostInterestScore(post, interestScores);

  return {
    score: (isFollowing ? 300 : 0) + (hasBaseInterest ? 80 : 0) + adaptiveScore,
    isFollowing,
    isRecommended: hasBaseInterest || adaptiveScore > 0,
    adaptiveScore,
  };
}

function getPostSortTimestamp(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const displayDate = String(value).match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
  if (displayDate) {
    const [, day, month, year, hour, minute] = displayDate;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
  }
  const directTimestamp = Date.parse(value);
  return Number.isNaN(directTimestamp) ? 0 : directTimestamp;
}

function compareFeedItemsByNewest(first, second) {
  const firstTimestamp = getPostSortTimestamp(first.post.createdAt);
  const secondTimestamp = getPostSortTimestamp(second.post.createdAt);
  return secondTimestamp - firstTimestamp || second.priority.score - first.priority.score;
}

function scrollToFeedTarget(selector, block = 'center') {
  setTimeout(() => {
    document.querySelector(selector)?.scrollIntoView({
      behavior: 'smooth',
      block,
    });
  }, 90);
}

// Tela Feed: cria posts, filtra conteudos, busca pessoas e conecta cards sociais.
function FeedView({
  posts,
  createFeedPost,
  shareFeedPost,
  reactToFeedPost,
  commentOnFeedPost,
  editFeedPost,
  deleteFeedPost,
  editFeedComment,
  deleteFeedComment,
  openPage,
  currentUser,
  profilePhoto,
  openMediaViewer,
  communityEvents,
  jobs,
  socialGraph,
  interestScores = {},
  recordFeedInterest,
  followProfile,
  requestFriendship,
  resolveFriendship,
  blockProfile,
  unblockProfile,
  openPrivateConversationWithProfile,
}) {
  const [draft, setDraft] = useState('');
  const [city, setCity] = useState('');
  const [media, setMedia] = useState(null);
  const [videoLink, setVideoLink] = useState('');
  const [videoLinkOpen, setVideoLinkOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [activeFeedFilter, setActiveFeedFilter] = useState('Tudo');
  const [selectedTrendTag, setSelectedTrendTag] = useState('');
  const [selectedHashtag, setSelectedHashtag] = useState('');
  const [postCategory, setPostCategory] = useState('Atualização');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showFeedRefreshHint, setShowFeedRefreshHint] = useState(false);
  const followingHandles = socialGraph.followingHandles;
  const friendRequests = socialGraph.sentFriendRequestHandles;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const refreshTimer = window.setTimeout(() => {
      setShowFeedRefreshHint(true);
    }, 120_000);

    return () => window.clearTimeout(refreshTimer);
  }, []);

  const feedFilters = ['Tudo', 'Seguindo', 'Recomendados', 'Minha cidade', 'Eventos', 'Vagas'];
  const totalComments = posts.reduce((total, post) => total + (post.comments?.length ?? 0), 0);
  const totalReactions = posts.reduce(
    (total, post) =>
      total + Object.values(post.reactionSummary ?? {}).reduce((sum, value) => sum + value, 0),
    0,
  );
  const trendingTags = [...new Set(posts.map((post) => post.tag).filter(Boolean))].slice(0, 5);
  const hashtagStats = buildHashtagStats(posts);
  const userInterests = currentUser?.interests ?? ['Tecnologia', 'Comunidade', 'Negócios locais', 'Eventos'];
  const topInterestSignals = getTopInterestSignals(interestScores, 4);
  const visiblePosts = posts
    .map((post) => {
      const priority = getFeedPriority(post, followingHandles, userInterests, interestScores);
      return {
        post,
        priority,
      };
    })
    .filter(({ post, priority }) => {
      if (selectedTrendTag && post.tag !== selectedTrendTag) return false;
      if (selectedHashtag && !extractHashtags(`${post.body ?? ''} ${post.tag ?? ''}`).includes(selectedHashtag)) {
        return false;
      }
      const filter = activeFeedFilter.toLowerCase();
      if (activeFeedFilter === 'Tudo') return true;
      if (activeFeedFilter === 'Seguindo') return priority.isFollowing;
      if (activeFeedFilter === 'Recomendados') return priority.isRecommended;
      if (activeFeedFilter === 'Minha cidade') {
        const cityToken = normalizeLocationName(city).split(',')[0].trim();
        return !cityToken || normalizeLocationName(post.city).includes(cityToken);
      }
      const haystack = `${post.tag} ${post.body} ${post.role}`.toLowerCase();
      if (filter === 'eventos') return /evento|live|networking|mentoria|agenda/.test(haystack);
      if (filter === 'vagas') return /vaga|oportunidade|emprego|freela|currículo/.test(haystack);
      return true;
    })
    .sort(compareFeedItemsByNewest);
  const peopleResults = socialProfiles.filter((profile) => {
    const query = peopleQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      profile.name.toLowerCase().includes(query) ||
      profile.handle.toLowerCase().includes(query)
    );
  });

  function submitPost(event) {
    event.preventDefault();
    if (videoLink.trim() && !getYouTubeVideo(videoLink)) {
      setLocationStatus('Cole um link válido do YouTube para publicar o vídeo.');
      return;
    }
    const createdPostId = createFeedPost({ body: draft, media, city, tag: postCategory });
    if (!createdPostId) {
      setLocationStatus('Escreva uma publicação ou anexe uma mídia antes de publicar.');
      return;
    }
    setDraft('');
    setMedia(null);
    setVideoLink('');
    setVideoLinkOpen(false);
    setPostCategory('Atualização');
    setLocationStatus(
      city.trim()
        ? `Publicação enviada com localização: ${city.trim()}.`
        : 'Publicação enviada sem localização definida.',
    );
    scrollToFeedTarget(`[data-post-id="${createdPostId}"]`, 'start');
  }

  function handleMediaChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setVideoLink('');
    setMedia({
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(file),
    });
  }

  function updateVideoLink(value) {
    setVideoLink(value);
    const youtubeMedia = createYouTubeMedia(value);
    if (youtubeMedia) {
      setMedia(youtubeMedia);
      setLocationStatus('Link do YouTube pronto para publicar.');
      return;
    }
    if (media?.type === 'youtube') {
      setMedia(null);
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocalização indisponível neste navegador.');
      return;
    }

    if (!window.isSecureContext) {
      setLocationStatus(
        'Localização exige ambiente seguro. Use localhost/127.0.0.1 ou HTTPS.',
      );
      return;
    }

    let permissionState = 'unknown';
    try {
      const permission = await navigator.permissions?.query?.({
        name: 'geolocation',
      });
      permissionState = permission?.state ?? 'unknown';
    } catch {
      // Alguns navegadores não expõem consulta de permissão; nesse caso seguimos para a solicitação nativa.
    }

    setLocationStatus(
      permissionState === 'denied'
        ? 'A permissão ainda aparece bloqueada para esta aba. Vou tentar solicitar novamente.'
        : 'Buscando localização...',
    );
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const coordinateLabel = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        setCity(`Localização: ${coordinateLabel}`);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`,
          );
          if (!response.ok) throw new Error('reverse-geocode-failed');
          const data = await response.json();
          const address = data.address ?? {};
          const cityLabel =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.state ||
            coordinateLabel;
          setCity(`${cityLabel}${address.state ? `, ${address.state}` : ''}`);
          setLocationStatus('Localização preenchida.');
        } catch {
          setLocationStatus('Usei as coordenadas porque a cidade não foi localizada.');
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus(
            'O navegador ainda não entregou a localização para esta aba. Confirme a permissão do site/porta atual e a permissão de localização do macOS; enquanto isso, digite a cidade e clique em Aplicar cidade.',
          );
          return;
        }

        if (error.code === error.TIMEOUT) {
          setLocationStatus(
            'Não consegui obter a localização a tempo. Tente novamente ou preencha a cidade manualmente.',
          );
          return;
        }

        setLocationStatus(
          'Não foi possível obter a localização. Preencha a cidade manualmente.',
        );
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 600000 },
    );
  }

  function applyManualCity() {
    const manualCity = city.trim().replace(/\s+/g, ' ');
    if (!manualCity) {
      setLocationStatus('Digite uma cidade ou local para aplicar manualmente.');
      return;
    }

    setCity(manualCity);
    setLocationStatus(`Cidade aplicada manualmente: ${manualCity}.`);
  }

  function openAuthorProfile(authorName) {
    setSelectedProfile(
      getSocialProfileByName(authorName) ?? {
        id: `profile-${authorName}`,
        name: authorName,
        handle: getUserHandle({ name: authorName }),
        initials: getInitials(authorName),
        city: 'Regional',
        bio: 'Perfil público com publicações, conexões, eventos e oportunidades.',
        interests: ['Publicações', 'Eventos', 'Oportunidades'],
        followers: 0,
        posts: posts.filter((post) => post.author === authorName).length,
      },
    );
  }

  function refreshVisibleFeed() {
    setShowFeedRefreshHint(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const recommendedCommunities = initialCommunities.slice(0, 3);
  const upcomingEvents = [...(communityEvents ?? []), ...scheduledEvents]
    .slice()
    .sort((a, b) => `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`))
    .slice(0, 3);
  const feedShortcutItems = [
    {
      id: 'communities',
      title: 'Comunidades',
      description: 'Explore grupos profissionais',
      icon: '👥',
    },
    {
      id: 'events',
      title: 'Eventos',
      description: 'Encontros e lives proximos',
      icon: '📅',
    },
    {
      id: 'opportunities',
      title: 'Oportunidades',
      description: 'Vagas e parcerias abertas',
      icon: '💼',
    },
    {
      id: 'benefits',
      title: 'Beneficios',
      description: 'Descontos e vantagens',
      icon: '🎁',
    },
  ];
  const selectedProfileEvents = selectedProfile ? getProfileEvents(selectedProfile, communityEvents) : [];
  const selectedProfileOpportunities = selectedProfile ? getProfileOpportunities(selectedProfile, jobs) : [];
  const selectedProfilePosts = selectedProfile ? getProfilePosts(selectedProfile, posts) : [];
  const selectedProfileStats = selectedProfile
    ? getViewedProfileStats(
        selectedProfile,
        socialGraph,
        selectedProfilePosts,
        selectedProfileEvents,
        selectedProfileOpportunities,
      )
    : null;

  return (
    <section className="feed-page">
      <div className="feed-layout feed-layout-3">
        <aside className="feed-left feed-sidebar">
          <section className="feed-widget">
            <PeopleDiscovery
              peopleQuery={peopleQuery}
              setPeopleQuery={setPeopleQuery}
              peopleResults={peopleResults}
              followingHandles={followingHandles}
              friendRequests={friendRequests}
              followProfile={followProfile}
              requestFriendship={requestFriendship}
              setSelectedProfile={setSelectedProfile}
            />
          </section>
          <section className="feed-widget">
            <div className="feed-widget-title">
              <strong>Atalhos</strong>
              <small>Rápido</small>
            </div>
            <div className="feed-shortcut-grid">
              {feedShortcutItems.map((item) => (
                <button className="feed-shortcut-card" key={item.id} type="button" onClick={() => openPage(item.id)}>
                  <span aria-hidden="true">{item.icon}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="feed-center">
          <div className="feed-mobile-discovery">
            <PeopleDiscovery
              peopleQuery={peopleQuery}
              setPeopleQuery={setPeopleQuery}
              peopleResults={peopleResults}
              followingHandles={followingHandles}
              friendRequests={friendRequests}
              followProfile={followProfile}
              requestFriendship={requestFriendship}
              setSelectedProfile={setSelectedProfile}
            />
          </div>

          <form className="feed-composer feed-composer-compact" onSubmit={submitPost}>
            <div className="composer-compact-row">
              <Avatar initials={currentUser?.initials ?? 'MP'} photo={profilePhoto} />
              <textarea
                rows={1}
                className="platform-textarea feed-textarea feed-textarea-compact"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
                  event.preventDefault();
                  submitPost(event);
                }}
                placeholder="O que você quer compartilhar?"
              />
              <button type="submit" className="composer-publish-button">
                Publicar
              </button>
            </div>

            <div className="composer-compact-tools">
              <div className="composer-media-actions" aria-label="Adicionar mídia">
                <label className="media-upload-button composer-media-button" aria-label="Adicionar foto" title="Adicionar foto">
                  <span aria-hidden="true">📷</span>
                  <strong>Foto</strong>
                  <input type="file" accept="image/*" onChange={handleMediaChange} />
                </label>
                <button
                  className="media-upload-button composer-media-button"
                  type="button"
                  aria-label="Adicionar vídeo do YouTube"
                  title="Adicionar vídeo do YouTube"
                  onClick={() => setVideoLinkOpen((current) => !current)}
                >
                  <span aria-hidden="true">▶</span>
                  <strong>Vídeo</strong>
                </button>
              </div>
              <button className="composer-event-button" type="button" onClick={() => openPage('event-create')}>
                + Evento
              </button>
              <details className="composer-advanced composer-advanced-compact">
                <summary>⚙</summary>
                <div className="feed-prompt-row content-category-row">
                  {['Atualização', 'Comunidade', 'Oportunidade', 'Evento'].map((item) => (
                    <button
                      className={postCategory === item ? 'active' : ''}
                      key={item}
                      type="button"
                      onClick={() => setPostCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="composer-meta">
                  <input
                    className="platform-input"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyManualCity();
                      }
                    }}
                    placeholder="Cidade ou local"
                  />
                  <button className="geo-button manual-location-button" type="button" onClick={applyManualCity}>
                    Aplicar
                  </button>
                  <button className="geo-button" type="button" onClick={useCurrentLocation}>
                    GPS
                  </button>
                </div>
              </details>
              <span className="selected-post-category">{postCategory}</span>
            </div>

            {locationStatus && <small className="location-status">{locationStatus}</small>}
            {videoLinkOpen && (
              <div className="youtube-link-composer">
                <label>
                  Link do YouTube
                  <input
                    className="platform-input"
                    value={videoLink}
                    onChange={(event) => updateVideoLink(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      const youtubeMedia = createYouTubeMedia(videoLink);
                      if (!youtubeMedia) {
                        setLocationStatus('Cole um link válido do YouTube.');
                        return;
                      }
                      setMedia(youtubeMedia);
                      setLocationStatus('Vídeo do YouTube anexado.');
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>
                <small>Suba o vídeo no YouTube e cole o link aqui. No feed, o vídeo reproduz dentro do próprio post.</small>
              </div>
            )}
            {media && (
              <div className="composer-preview">
                <div
                  className="composer-preview-media"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    openMediaViewer?.({
                      type: media.type,
                      src: media.url,
                      embedUrl: media.embedUrl,
                      title: media.type === 'youtube'
                        ? 'Prévia do vídeo do YouTube'
                        : media.type === 'video'
                          ? 'Prévia do vídeo'
                          : 'Prévia da foto',
                      caption: media.name,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    openMediaViewer?.({
                      type: media.type,
                      src: media.url,
                      embedUrl: media.embedUrl,
                      title: media.type === 'youtube'
                        ? 'Prévia do vídeo do YouTube'
                        : media.type === 'video'
                          ? 'Prévia do vídeo'
                          : 'Prévia da foto',
                      caption: media.name,
                    });
                  }}
                >
                  {media.type === 'youtube' ? (
                    <img src={media.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                  ) : media.type === 'video' ? <video src={media.url} controls /> : <img src={media.url} alt="" />}
                  <span>{media.type === 'youtube' ? 'Reproduzir YouTube' : 'Abrir em tela cheia'}</span>
                </div>
                <button className="composer-remove-media" type="button" onClick={() => setMedia(null)}>Remover mídia</button>
              </div>
            )}
          </form>

          <div className="feed-toolbar">
            <details className="feed-filter-menu feed-filter-menu-compact">
              <summary>
                <span aria-hidden="true">⚙</span>
                <strong>Filtros</strong>
              </summary>
              <div className="feed-filter-menu-body">
                <span>
                  {selectedTrendTag
                    ? `Assunto #${selectedTrendTag.replace(/\s+/g, '')}`
                    : 'Escolha o que acompanhar agora.'}
                </span>
                <div className="feed-filter-row">
                  {selectedTrendTag && (
                    <button className="active" onClick={() => setSelectedTrendTag('')} type="button">
                      Limpar assunto
                    </button>
                  )}
                  {selectedHashtag && (
                    <button className="active" onClick={() => setSelectedHashtag('')} type="button">
                      Limpar hashtag
                    </button>
                  )}
                  {feedFilters.map((filter) => (
                    <button
                      className={activeFeedFilter === filter ? 'active' : ''}
                      key={filter}
                      onClick={() => {
                        setActiveFeedFilter(filter);
                        setSelectedTrendTag('');
                        setSelectedHashtag('');
                      }}
                      type="button"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </details>
            {showFeedRefreshHint && (
              <button className="feed-refresh-hint" type="button" onClick={refreshVisibleFeed}>
                Ver novos posts
              </button>
            )}
            <div className="feed-toolbar-status">
              {selectedHashtag
                ? `Mostrando ${selectedHashtag}`
                : selectedTrendTag
                ? `Mostrando #${selectedTrendTag.replace(/\s+/g, '')}`
                : activeFeedFilter !== 'Tudo'
                  ? `Filtro: ${activeFeedFilter}`
                  : 'Tudo'}
            </div>
          </div>

          <div className="mobile-hashtag-strip">
            <strong>Hashtags</strong>
            <div>
              {hashtagStats.length === 0 ? (
                <span className="empty-inline-note">Nenhuma hashtag usada ainda.</span>
              ) : hashtagStats.slice(0, 5).map((item) => (
                <button
                  className={selectedHashtag === item.tag ? 'feed-side-card-button active' : 'feed-side-card-button'}
                  key={item.tag}
                  type="button"
                  onClick={() => {
                    setSelectedHashtag((current) => (current === item.tag ? '' : item.tag));
                    setSelectedTrendTag('');
                    setActiveFeedFilter('Tudo');
                  }}
                >
                  <span>{item.tag}</span>
                  <small>{formatHashtagUsage(item.count)} usaram</small>
                </button>
              ))}
            </div>
          </div>

          <div className="post-list">
            {visiblePosts.length === 0 ? (
              <p className="empty-state">Nenhuma publicação encontrada para este filtro.</p>
            ) : visiblePosts.map(({ post, priority }) => (
              <FeedPostCard
                key={post.id}
                post={post}
                priorityLabel={
                  priority.isFollowing
                    ? 'Seguindo'
                    : priority.adaptiveScore > 0
                      ? 'Para você'
                      : priority.isRecommended
                        ? 'Recomendado'
                        : ''
                }
                onPostImpression={recordFeedInterest}
                shareFeedPost={shareFeedPost}
                reactToFeedPost={reactToFeedPost}
                commentOnFeedPost={commentOnFeedPost}
                editFeedPost={editFeedPost}
                deleteFeedPost={deleteFeedPost}
                editFeedComment={editFeedComment}
                deleteFeedComment={deleteFeedComment}
                currentUser={currentUser}
                profilePhoto={profilePhoto}
                openAuthorProfile={openAuthorProfile}
                openMediaViewer={openMediaViewer}
              />
            ))}
          </div>
        </div>

        <aside className="feed-right feed-sidebar">
          <section className="feed-widget dark">
            <span className="section-kicker">Ao vivo na rede</span>
            <strong>{posts.length} publicações</strong>
            <p>
              {posts.length
                ? `${totalReactions} reações e ${totalComments} comentários movimentando a comunidade.`
                : 'A rede ainda está limpa. As primeiras publicações aparecerão aqui.'}
            </p>
          </section>
          <section className="feed-widget interest-widget">
            <strong>Para você</strong>
            {topInterestSignals.length === 0 ? (
              <p>Reaja, comente ou veja posts para calibrar seu feed.</p>
            ) : (
              <div className="interest-chip-list">
                {topInterestSignals.map((item) => (
                  <button
                    className="feed-side-card-button"
                    key={item.signal}
                    type="button"
                    onClick={() => {
                      setSelectedTrendTag('');
                      setSelectedHashtag('');
                      setActiveFeedFilter('Recomendados');
                    }}
                  >
                    {item.signal}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="feed-widget">
            <strong>Assuntos em alta</strong>
            <div className="trend-tag-list">
              {trendingTags.length === 0 ? (
                <p className="empty-state">Sem assuntos em alta por enquanto.</p>
              ) : trendingTags.map((tag) => (
                <button
                  className={selectedTrendTag === tag ? 'feed-side-card-button active' : 'feed-side-card-button'}
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTrendTag((current) => (current === tag ? '' : tag));
                    setSelectedHashtag('');
                    setActiveFeedFilter('Tudo');
                  }}
                >
                  #{tag.replace(/\s+/g, '')}
                </button>
              ))}
            </div>
          </section>
          <section className="feed-widget hashtag-widget">
            <strong>Hashtags em alta</strong>
            <div className="hashtag-list">
              {hashtagStats.length === 0 ? (
                <p className="empty-state">Nenhuma hashtag usada ainda.</p>
              ) : hashtagStats.map((item) => (
                <button
                  className={selectedHashtag === item.tag ? 'feed-side-card-button active' : 'feed-side-card-button'}
                  key={item.tag}
                  type="button"
                  onClick={() => {
                    setSelectedHashtag((current) => (current === item.tag ? '' : item.tag));
                    setSelectedTrendTag('');
                    setActiveFeedFilter('Tudo');
                  }}
                >
                  <span>{item.tag}</span>
                  <small>{formatHashtagUsage(item.count)} usaram</small>
                </button>
              ))}
            </div>
          </section>
          <section className="feed-widget">
            <strong>Comunidades recomendadas</strong>
            <div className="feed-mini-list">
              {recommendedCommunities.length === 0 ? (
                <p className="empty-state">Nenhuma comunidade criada ainda.</p>
              ) : recommendedCommunities.map((community) => (
                <button className="feed-mini-row" key={community.id} type="button" onClick={() => openPage('communities')}>
                  <span aria-hidden="true">{getInitials(community.name)}</span>
                  <div>
                    <strong>{community.name}</strong>
                    <small>{community.members} membros</small>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="feed-widget">
            <strong>Eventos próximos</strong>
            <div className="feed-mini-list">
              {upcomingEvents.length === 0 ? (
                <p className="empty-state">Nenhum evento programado ainda.</p>
              ) : upcomingEvents.map((event) => (
                <button
                  className="feed-mini-row"
                  key={`${event.title}-${event.date}-${event.time}`}
                  type="button"
                  onClick={() => openPage('events')}
                >
                  <span aria-hidden="true">+</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.date} • {event.time}</small>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {selectedProfile && (
        <SocialProfileModal
          profile={selectedProfile}
          isFollowing={followingHandles.includes(selectedProfile.handle)}
          requestSent={friendRequests.includes(selectedProfile.handle)}
          followProfile={followProfile}
          requestFriendship={requestFriendship}
          resolveFriendship={resolveFriendship}
          socialGraph={socialGraph}
          currentUser={currentUser}
          currentUserPhoto={profilePhoto}
          profileStats={selectedProfileStats}
          profilePosts={selectedProfilePosts}
          profileEvents={selectedProfileEvents}
          profileOpportunities={selectedProfileOpportunities}
          blockProfile={blockProfile}
          unblockProfile={unblockProfile}
          openPrivateConversationWithProfile={openPrivateConversationWithProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </section>
  );
}

// Busca social: painel discreto para encontrar perfis, seguir e solicitar amizade.
function PeopleDiscovery({
  peopleQuery,
  setPeopleQuery,
  peopleResults,
  followingHandles,
  friendRequests,
  followProfile,
  requestFriendship,
  setSelectedProfile,
}) {
  const discoveryRef = useRef(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const suggestedPeople = peopleResults.slice(0, 3);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (discoveryRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  function handleQueryChange(value) {
    setPeopleQuery(value);
    const term = value.trim();
    if (term.length < 3) return;
    setRecentSearches((current) => [term, ...current.filter((item) => item !== term)].slice(0, 5));
  }

  return (
    <section
      className={isOpen ? 'social-sidebar-card people-discovery-card open' : 'social-sidebar-card people-discovery-card'}
      ref={discoveryRef}
    >
      <button
        aria-label="Encontrar pessoas"
        aria-expanded={isOpen}
        className="people-discovery-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="people-discovery-icon" aria-hidden="true">🔎</span>
        <span className="people-discovery-label">
          <strong>Encontrar pessoas</strong>
          <small>Conexões e perfis</small>
        </span>
        <span className="people-count">{peopleResults.length}</span>
        <span className="people-discovery-arrow" aria-hidden="true">{isOpen ? '↑' : '→'}</span>
      </button>
      {isOpen && (
        <div className="people-discovery-body">
          <input
            value={peopleQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Nome ou @usuário"
            autoFocus
          />
          <div className="people-search-context">
            <strong>{peopleQuery.trim() ? 'Resultados' : 'Pesquisas recentes'}</strong>
            {!peopleQuery.trim() && recentSearches.length > 0 && (
              <div>
                {recentSearches.map((term) => (
                  <button className="people-chip-button" key={term} type="button" onClick={() => setPeopleQuery(term)}>
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="people-result-list">
            {peopleResults.length === 0 ? (
              <p className="empty-state">Nenhuma pessoa encontrada ainda.</p>
            ) : peopleResults.slice(0, 4).map((profile) => {
              const isFollowing = followingHandles.includes(profile.handle);
              const requestSent = friendRequests.includes(profile.handle);
              return (
                <article key={profile.id}>
                  <button
                    className="person-open-button"
                    type="button"
                    onClick={() => setSelectedProfile(profile)}
                  >
                    <Avatar initials={profile.initials} photo={profile.photo} />
                    <span>
                      <strong>{profile.name}</strong>
                      <small>{profile.handle} • {profile.city}</small>
                    </span>
                  </button>
                  <div className="person-actions">
                    <button className="person-action-button" type="button" onClick={() => followProfile(profile.handle)}>
                      {isFollowing ? 'Deixar' : 'Seguir'}
                    </button>
                    <button
                      className="light person-action-button"
                      disabled={requestSent}
                      type="button"
                      onClick={() => requestFriendship(profile.handle)}
                    >
                      {requestSent ? 'Enviado' : 'Amizade'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="people-search-context">
            <strong>Sugestões</strong>
            <div>
              {suggestedPeople.length === 0 ? (
                <span className="empty-inline-note">Sem sugestões por enquanto.</span>
              ) : suggestedPeople.map((profile) => (
                <button className="people-chip-button" key={profile.id} type="button" onClick={() => setSelectedProfile(profile)}>
                  {profile.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Modal de perfil publico: mostra conexoes, posts e acoes sociais do autor.
function SocialProfileModal({
  profile,
  isFollowing,
  requestSent,
  followProfile,
  requestFriendship,
  resolveFriendship,
  socialGraph,
  currentUser,
  currentUserPhoto,
  profileStats,
  profilePosts = [],
  profileEvents = [],
  profileOpportunities = [],
  blockProfile,
  unblockProfile,
  openPrivateConversationWithProfile,
  onClose,
}) {
  const [activeSection, setActiveSection] = useState('posts');
  const isBlocked = socialGraph.blockedHandles.includes(profile.handle);
  const currentUserProfile = getCurrentUserSocialProfile(currentUser, null, currentUserPhoto);
  const friendProfiles = getConnectionProfiles(getProfileSampleHandles(profile, 1, 3));
  const followingProfiles = getConnectionProfiles(getProfileSampleHandles(profile, 0, 3));
  const followerProfiles = [
    ...(isFollowing ? [currentUserProfile] : []),
    ...getConnectionProfiles(getProfileSampleHandles(profile, 2, 3)),
  ];
  const commonHandles = uniqueItems([...socialGraph.friendHandles, ...socialGraph.followingHandles]).filter((handle) =>
    [...friendProfiles, ...followingProfiles, ...followerProfiles].some((item) => item.handle === handle),
  );
  const commonProfiles = getConnectionProfiles(commonHandles).slice(0, 3);
  const stats = profileStats ?? getViewedProfileStats(profile, socialGraph, profilePosts, profileEvents, profileOpportunities);
  const sectionTitle = {
    friends: 'Amigos',
    followers: 'Seguidores',
    following: 'Seguindo',
    events: 'Eventos publicados',
    opportunities: 'Oportunidades disponíveis',
    posts: 'Publicações',
  }[activeSection];

  function renderConnectionList(list) {
    if (!list.length) return <p className="empty-state">Nenhuma conexão pública disponível.</p>;

    return (
      <div className="social-connection-list">
        {list.map((item) => {
          const blocked = socialGraph.blockedHandles.includes(item.handle);
          const following = socialGraph.followingHandles.includes(item.handle);
          const isCurrentUser = item.handle === currentUserProfile.handle;
          return (
            <article key={item.handle}>
              <Avatar initials={item.initials} photo={item.photo} />
              <div>
                <strong>{item.name}</strong>
                <small>{item.handle} • {item.city}</small>
                {commonHandles.includes(item.handle) && <em>em comum</em>}
              </div>
              {isCurrentUser ? (
                <span className="self-connection-pill">Você</span>
              ) : (
                <button className="light compact-social-button" type="button" onClick={() => followProfile(item.handle)}>
                  {following ? 'Seguindo' : 'Seguir'}
                </button>
              )}
              <button
                className={blocked ? 'light compact-social-button' : 'danger-soft compact-social-button'}
                type="button"
                onClick={() => (blocked ? unblockProfile(item.handle) : blockProfile(item.handle))}
              >
                {blocked ? 'Desbloq.' : 'Bloq.'}
              </button>
            </article>
          );
        })}
      </div>
    );
  }

  function renderProfileSection() {
    if (activeSection === 'followers') return renderConnectionList(followerProfiles);
    if (activeSection === 'following') return renderConnectionList(followingProfiles);
    if (activeSection === 'friends') return renderConnectionList(friendProfiles);
    if (activeSection === 'events') {
      return profileEvents.length ? (
        <div className="social-mini-list">
          {profileEvents.map((event) => (
            <article key={`${event.title}-${event.date}-${event.time}`}>
              <strong>{event.title}</strong>
              <small>{event.mode} • {event.date} às {event.time}</small>
              <p>{event.description}</p>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Este perfil ainda não publicou eventos.</p>;
    }
    if (activeSection === 'opportunities') {
      return profileOpportunities.length ? (
        <div className="social-mini-list">
          {profileOpportunities.map((job) => (
            <article key={job.id}>
              <strong>{job.title}</strong>
              <small>{job.company} • {job.city}</small>
              <p>{job.type} disponível • {job.salary}</p>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Nenhuma oportunidade ativa para este perfil.</p>;
    }

    return profilePosts.length ? (
      <div className="social-mini-list">
        {profilePosts.map((post) => (
          <article key={post.id}>
            <strong>{post.tag}</strong>
            <small>{post.city} • {post.createdAt ?? 'Agora'}</small>
            <p>{post.body}</p>
          </article>
        ))}
      </div>
    ) : (
      <div className="profile-post-grid">
        {profile.interests.map((interest) => (
          <article key={interest}>
            <span>{interest}</span>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="floating-backdrop" onClick={onClose}>
      <section className="floating-modal social-profile-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <div className="social-profile-cover" />
        <div className="social-profile-head">
          <Avatar initials={profile.initials} photo={profile.photo} />
          <div>
            <h3>{profile.name}</h3>
            <span>{profile.handle} • {profile.city}</span>
            <p>{profile.bio}</p>
          </div>
        </div>
        <div className="social-profile-stats">
          <button type="button" onClick={() => setActiveSection('friends')}><strong>{formatExactCount(stats.friends)}</strong><span>{formatCountLabel(stats.friends, 'amigo', 'amigos')}</span></button>
          <button type="button" onClick={() => setActiveSection('followers')}><strong>{formatExactCount(stats.followers)}</strong><span>{formatCountLabel(stats.followers, 'seguidor', 'seguidores')}</span></button>
          <button type="button" onClick={() => setActiveSection('following')}><strong>{formatExactCount(stats.following)}</strong><span>seguindo</span></button>
          <button type="button" onClick={() => setActiveSection('posts')}><strong>{formatExactCount(stats.posts)}</strong><span>{formatCountLabel(stats.posts, 'post', 'posts')}</span></button>
          <button type="button" onClick={() => setActiveSection('events')}><strong>{formatExactCount(stats.events)}</strong><span>{formatCountLabel(stats.events, 'evento', 'eventos')}</span></button>
          <button type="button" onClick={() => setActiveSection('opportunities')}><strong>{formatExactCount(stats.opportunities)}</strong><span>{formatCountLabel(stats.opportunities, 'oportunidade', 'oportunidades')}</span></button>
        </div>
        {commonProfiles.length > 0 && (
          <div className="mutual-connection-strip">
            <strong>Em comum</strong>
            <span>{commonProfiles.map((item) => item.name).join(', ')}</span>
          </div>
        )}
        <div className="social-profile-public-info">
          <article>
            <strong>Informações públicas</strong>
            <p>{profile.bio}</p>
          </article>
          <article>
            <strong>Conexões</strong>
            <p>Amigos, seguidores, seguindo e comunidades em comum ficam visíveis conforme privacidade do usuário.</p>
          </article>
        </div>
        <div className="profile-social-actions">
          <button type="button" onClick={() => followProfile(profile.handle)}>
            {isFollowing ? 'Deixar de seguir' : 'Seguir'}
          </button>
          <button
            className="light"
            disabled={requestSent}
            type="button"
            onClick={() => requestFriendship(profile.handle)}
          >
            {requestSent ? 'Solicitação enviada' : 'Solicitar amizade'}
          </button>
          <button
            className="light"
            type="button"
            onClick={() => {
              openPrivateConversationWithProfile(profile);
              onClose();
            }}
          >
            Mensagem
          </button>
          <button
            className={isBlocked ? 'light' : 'danger-soft'}
            type="button"
            onClick={() => (isBlocked ? unblockProfile(profile.handle) : blockProfile(profile.handle))}
          >
            {isBlocked ? 'Desbloquear' : 'Bloquear'}
          </button>
        </div>
        {requestSent && (
          <div className="friend-request-review">
            <strong>Prévia da moderação de amizade</strong>
            <button type="button" onClick={() => resolveFriendship(profile.handle, true)}>
              Aceitar
            </button>
            <button className="light" type="button" onClick={() => resolveFriendship(profile.handle, false)}>
              Recusar
            </button>
          </div>
        )}
        <section className="social-profile-section">
          <div className="profile-card-heading">
            <h3>{sectionTitle}</h3>
          </div>
          {renderProfileSection()}
        </section>
      </section>
    </div>
  );
}

// Card de post: concentra reacoes, comentarios, compartilhamento, menu e edicao.
function FeedPostCard({
  post,
  priorityLabel,
  shareFeedPost,
  reactToFeedPost,
  commentOnFeedPost,
  editFeedPost,
  deleteFeedPost,
  editFeedComment,
  deleteFeedComment,
  currentUser,
  profilePhoto,
  openAuthorProfile,
  openMediaViewer,
  onPostImpression,
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState(post.body ?? '');
  const [editingCommentId, setEditingCommentId] = useState('');
  const [commentEditDraft, setCommentEditDraft] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inlineYoutubePlaying, setInlineYoutubePlaying] = useState(false);
  const [youtubeFallbackVisible, setYoutubeFallbackVisible] = useState(false);
const postRef = React.useRef(null);
const reactionPickerRef = React.useRef(null);
const reactionDetailRef = React.useRef(null);
const commentPanelRef = React.useRef(null);
const reactionHoldTimerRef = React.useRef(null);
const reactionHoldOpenedRef = React.useRef(false);
const impressionRegisteredRef = React.useRef(false);

useEffect(() => {
  if (!menuOpen) return undefined;

  function closeMenuOnOutsideClick(event) {
    if (event.target?.closest?.(`[data-post-menu-id="${post.id}"]`)) return;
    setMenuOpen(false);
  }

  document.addEventListener('pointerdown', closeMenuOnOutsideClick);
  return () => document.removeEventListener('pointerdown', closeMenuOnOutsideClick);
}, [menuOpen, post.id]);

useEffect(() => {
  if (!reactionPickerOpen) return undefined;

  function closeReactionPicker(event) {
    if (reactionPickerRef.current?.contains(event.target)) return;
    setReactionPickerOpen(false);
  }

  document.addEventListener('pointerdown', closeReactionPicker);
  return () => document.removeEventListener('pointerdown', closeReactionPicker);
}, [reactionPickerOpen]);

useEffect(() => {
  if (!reactionsOpen) return undefined;

  function closeReactionDetails(event) {
    if (reactionDetailRef.current?.contains(event.target)) return;
    if (event.target?.closest?.(`[data-reaction-trigger-id="${post.id}"]`)) return;
    setReactionsOpen(false);
  }

  document.addEventListener('pointerdown', closeReactionDetails);
  return () => document.removeEventListener('pointerdown', closeReactionDetails);
}, [reactionsOpen, post.id]);

useEffect(() => {
  if (!commentsOpen) return undefined;

  function closeCommentsOnOutsideClick(event) {
    if (commentPanelRef.current?.contains(event.target)) return;
    if (event.target?.closest?.(`[data-comment-trigger-id="${post.id}"]`)) return;
    setCommentsOpen(false);
    setEditingCommentId('');
  }

  document.addEventListener('pointerdown', closeCommentsOnOutsideClick);
  return () => document.removeEventListener('pointerdown', closeCommentsOnOutsideClick);
}, [commentsOpen, post.id]);

useEffect(() => () => {
  window.clearTimeout(reactionHoldTimerRef.current);
}, []);

useEffect(() => {
  const element = postRef.current;
  if (!element) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      setIsVisible(entry.isIntersecting);
      if (entry.isIntersecting && !impressionRegisteredRef.current) {
        impressionRegisteredRef.current = true;
        onPostImpression?.(post, 'view');
      }
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
  );

  observer.observe(element);

  return () => observer.disconnect();
}, []);
  const totalReactions = Object.values(post.reactionSummary ?? {}).reduce(
    (total, value) => total + value,
    0,
  );
  const comments = post.comments ?? [];
  const reactors = post.reactors ?? [];
  const reactionLabelById = Object.fromEntries(feedReactions.map((reaction) => [reaction.id, reaction]));

  function submitComment() {
    const commentId = commentOnFeedPost(post.id, commentDraft);
    setCommentDraft('');
    setCommentsOpen(true);
    if (commentId) {
      scrollToFeedTarget(`[data-comment-id="${commentId}"]`);
      return;
    }
    scrollToFeedTarget(`[data-comment-panel-id="${post.id}"]`);
  }

function sharePost() {
  const confirmed = window.confirm(`Republicar a publicação de ${post.author} no seu feed?`);
  if (!confirmed) return;

  const sharedPostId = shareFeedPost(post);
  setShareStatus('Publicação republicada no seu feed.');
  if (sharedPostId) {
    scrollToFeedTarget(`[data-post-id="${sharedPostId}"]`, 'start');
  }
}

  function openReactionsWindow() {
    setReactionsOpen((current) => !current);
    scrollToFeedTarget(`[data-reaction-window-id="${post.id}"]`);
  }

  function showCommentsPanel() {
    setCommentsOpen(true);
    scrollToFeedTarget(`[data-comment-panel-id="${post.id}"]`);
  }

  function toggleCommentsPanel() {
    const nextState = !commentsOpen;
    setCommentsOpen(nextState);
    if (nextState) {
      scrollToFeedTarget(`[data-comment-panel-id="${post.id}"]`);
    }
  }

  function openReactionPicker() {
    setReactionPickerOpen(true);
  }

  function startReactionHold() {
    window.clearTimeout(reactionHoldTimerRef.current);
    reactionHoldOpenedRef.current = false;
    reactionHoldTimerRef.current = window.setTimeout(() => {
      reactionHoldOpenedRef.current = true;
      openReactionPicker();
    }, 280);
  }

  function stopReactionHold() {
    window.clearTimeout(reactionHoldTimerRef.current);
  }

  function selectReaction(reactionId) {
    reactToFeedPost(post.id, reactionId);
    setReactionPickerOpen(false);
  }

  function toggleReactionPicker() {
    if (reactionHoldOpenedRef.current) {
      reactionHoldOpenedRef.current = false;
      return;
    }
    setReactionPickerOpen((current) => !current);
  }

	  const selectedReaction =
	    reactionLabelById[post.selectedReaction] ?? feedReactions[0];
	  const youtubeVideo = post.mediaType === 'youtube' ? getYouTubeVideo(post.mediaUrl) : null;
  const inlineYoutubeEmbedUrl = youtubeVideo
    ? getInlineYouTubeEmbedUrl(youtubeVideo, { autoplay: inlineYoutubePlaying, muted: inlineYoutubePlaying })
    : '';

  function openPostMediaPreview() {
    if (youtubeVideo) {
      openMediaViewer?.({
        type: 'youtube',
        src: youtubeVideo.watchUrl,
        embedUrl: getInlineYouTubeEmbedUrl(youtubeVideo, { autoplay: true, muted: true }),
        title: post.tag ? `${post.tag} • ${post.author}` : post.author,
        caption: `${post.author} - ${post.city}`,
      });
      return;
    }

    openMediaViewer?.({
      type: post.mediaType,
      src: post.mediaUrl,
      title: post.tag ? `${post.tag} • ${post.author}` : post.author,
      caption: `${post.author} - ${post.city}`,
    });
	  }

  function playYoutubeInline() {
    if (!youtubeVideo) return;
    setYoutubeFallbackVisible(false);
    setInlineYoutubePlaying(true);
  }

  function openYoutubeInNewTab() {
    if (!youtubeVideo) return;
    window.open(youtubeVideo.watchUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
  ref={postRef}
  data-post-id={post.id}
  className={`post-card reveal-card ${isVisible ? 'visible' : ''} ${reactionsOpen ? 'reaction-layer-open' : ''}`}
>
      <header className="social-post-header">
        <Avatar initials={post.initials} photo={post.photo} />

        <button
          className="social-post-author profile-open-link"
          type="button"
          onClick={() => openAuthorProfile(post.author)}
        >
          <div className="post-author-line">
            <strong>{post.author}</strong>
            {['Patrocinador', 'Conteúdo de autoridade', 'Comunidade PJ'].includes(post.role) && (
              <span>verificado</span>
            )}
          </div>

          <small>
            {post.role} • {post.city}
            {priorityLabel ? ` • ${priorityLabel}` : ''}
          </small>

          {post.createdAt && (
            <time>{post.createdAt}</time>
          )}
        </button>

        <div className="post-header-actions" data-post-menu-id={post.id}>
          <span className="post-tag-badge">{post.tag}</span>
          <button
            type="button"
            aria-label="Mais opções"
            onClick={() => setMenuOpen((current) => !current)}
          />
          {menuOpen && (
            <div className="post-menu">
              <button
                type="button"
                onClick={() => {
                  setShareStatus('Publicação salva para ver depois.');
                  setMenuOpen(false);
                }}
              >
                Salvar post
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText?.(`${window.location.href}#${post.id}`);
                  setShareStatus('Link da publicação copiado.');
                  setMenuOpen(false);
                }}
              >
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareStatus('Denúncia enviada para moderação.');
                  setMenuOpen(false);
                }}
              >
                Denunciar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPost(true);
                  setMenuOpen(false);

                  setTimeout(() => {
                    document
                      .querySelector(`[data-edit-post-id="${post.id}"]`)
                      ?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                  }, 80);
                }}
              >
                Editar publicação
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => {
                  const confirmed = window.confirm('Apagar esta publicação?');
                  if (!confirmed) return;
                  deleteFeedPost(post.id);
                  setMenuOpen(false);
                  scrollToFeedTarget('.post-list', 'start');
                }}
              >
                Apagar publicação
              </button>
            </div>
          )}
        </div>
      </header>

{post.sharedFrom && (
  <div className="shared-origin social-share-box">
    <div className="share-line">
      <span className="share-icon">↗</span>
      <div>
        <strong>{post.author}</strong>
        <small>republicou esta publicação</small>
      </div>
    </div>

    <div className="original-post-box">
      <div className="original-post-header">
        <Avatar initials={post.sharedFrom.author?.slice(0, 2).toUpperCase() || 'OR'} />
        <div>
          <strong>{post.sharedFrom.author}</strong>
          <small>
            {post.sharedFrom.role} - {post.sharedFrom.city}
            {post.sharedFrom.createdAt ? ` • ${post.sharedFrom.createdAt}` : ''}
          </small>
        </div>
      </div>

      {post.sharedFrom.sharedAt && (
        <small className="share-time">
          Compartilhado em {post.sharedFrom.sharedAt}
        </small>
      )}
    </div>
  </div>
)}

      {isEditingPost ? (
        <div className="inline-edit-box post-edit-panel" data-edit-post-id={post.id}>
          <textarea
  className="platform-textarea"
  value={postDraft}
  onChange={(event) => setPostDraft(event.target.value)}
/>
          <div className="micro-actions edit-save-actions">
  <button
    className="social-action-button save-action"
    onClick={() => {
      editFeedPost(post.id, postDraft);
      setIsEditingPost(false);
      scrollToFeedTarget(`[data-post-id="${post.id}"]`);
    }}
  >
    💾 Salvar alterações
  </button>

  <button
    className="social-action-button cancel-action"
    onClick={() => {
      setPostDraft(post.body ?? '');
      setIsEditingPost(false);
    }}
  >
    ↩ Cancelar edição
  </button>
</div>
        </div>
      ) : (
post.body && (
  <div className="social-post-content">
    <p>{post.body}</p>

    {post.edited && (
      <small className="edited-label">editado</small>
    )}
  </div>
)
      )}
	      {post.mediaUrl && post.mediaType === 'youtube' && youtubeVideo && (
	        <div className="post-youtube-card">
          {inlineYoutubePlaying ? (
              <div className="post-media youtube-media youtube-inline-player video-wrapper">
                <iframe
                  title={`Vídeo do YouTube - ${post.author}`}
                  src={inlineYoutubeEmbedUrl}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onError={() => setYoutubeFallbackVisible(true)}
                />
                <span className="media-credit">
                  Tocando mutado. Use o controle do player para ativar o som.
                </span>
              </div>
            ) : (
              <button
                className="post-media youtube-media"
                type="button"
                onClick={playYoutubeInline}
                aria-label="Reproduzir vídeo do YouTube no feed"
              >
                <img src={post.mediaThumbnailUrl || youtubeVideo.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                <span className="youtube-play-overlay">▶</span>
                <span className="media-credit">
                  {post.author} - {post.city}
                </span>
              </button>
            )}
	          <button
	            className="youtube-link-chip"
	            type="button"
	            onClick={openYoutubeInNewTab}
	          >
	            Assistir no YouTube
	          </button>
            {youtubeFallbackVisible && (
              <div className="youtube-embed-fallback">
                <strong>Se o player mostrar erro, este vídeo bloqueia incorporação externa.</strong>
                <span>Você ainda pode assistir diretamente no YouTube sem quebrar o feed.</span>
                <button type="button" onClick={openYoutubeInNewTab}>
                  Abrir no YouTube
                </button>
              </div>
            )}
	        </div>
	      )}
      {post.mediaUrl && post.mediaType !== 'youtube' && (
        <div
          className="post-media"
          role="button"
          tabIndex={0}
          onClick={openPostMediaPreview}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openPostMediaPreview();
          }}
        >
          {post.mediaType === 'video' ? (
            <video src={post.mediaUrl} preload="metadata" playsInline style={{ pointerEvents: 'none' }} />
          ) : (
            <img src={post.mediaUrl} alt="" loading="lazy" decoding="async" />
          )}
          <span className="media-credit">
            {post.author} - {post.city}
          </span>
        </div>
      )}
      {!post.mediaUrl && post.mediaType && (
        <div className={`post-media mock ${post.mediaType}`}>
          <strong>{post.mediaType === 'video' ? 'Vídeo publicado' : 'Imagem publicada'}</strong>
          <span className="media-credit">
            {post.author} - {post.city}
          </span>
        </div>
      )}
      <div className="post-stats">
        <div className="reaction-popover-wrap">
          <div className="reaction-stack" aria-hidden="true">
            {feedReactions.slice(0, 3).map((reaction) => (
              <span key={reaction.id}>{reaction.icon}</span>
            ))}
          </div>
          <button
            className="reaction-summary-button"
            data-reaction-trigger-id={post.id}
            onClick={openReactionsWindow}
          >
            {totalReactions || post.likes} reações
          </button>
          {reactionsOpen && (
            <section
              className="reaction-detail-panel reaction-detail-popover"
              data-reaction-window-id={post.id}
              ref={reactionDetailRef}
            >
              <header>
                <strong>Quem reagiu</strong>
                <button type="button" onClick={() => setReactionsOpen(false)}>Fechar</button>
              </header>
              {reactors.length === 0 ? (
                <p>Nenhum nome registrado ainda para estas reações antigas.</p>
              ) : (
                reactors.map((item) => {
                  const reaction = reactionLabelById[item.reaction] ?? { icon: '•', label: item.reaction };
                  return (
                    <article key={`${item.user}-${item.reaction}-${item.at}`}>
                      <span>{reaction.icon}</span>
                      <div>
                        <strong>{item.user}</strong>
                        <small>{reaction.label} • {item.at}</small>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          )}
        </div>
        <button className="comment-count-button" data-comment-trigger-id={post.id} onClick={toggleCommentsPanel}>
          {comments.length} comentário(s)
        </button>
      </div>
      <footer className="post-actions-bar">
        <div className="reaction-picker-wrap" ref={reactionPickerRef}>
          {reactionPickerOpen && (
            <div className="reaction-picker" role="menu" aria-label="Escolher reação">
              {feedReactions.map((reaction) => (
                <button
                  aria-label={reaction.label}
                  className={post.selectedReaction === reaction.id ? 'reaction-picker-button active' : 'reaction-picker-button'}
                  key={reaction.id}
                  onClick={() => selectReaction(reaction.id)}
                  role="menuitem"
                  title={reaction.label}
                  type="button"
                >
                  <span>{reaction.icon}</span>
                  <small>{reaction.label}</small>
                </button>
              ))}
            </div>
          )}

            <button
              aria-expanded={reactionPickerOpen}
              aria-haspopup="menu"
              className={post.selectedReaction ? 'social-action-button reaction-main-button active' : 'social-action-button reaction-main-button'}
              onClick={toggleReactionPicker}
              onPointerDown={startReactionHold}
              onPointerLeave={stopReactionHold}
              onPointerUp={stopReactionHold}
              title="Clique ou segure para escolher uma reação"
              type="button"
            >
              <span>{selectedReaction.icon}</span>
              {post.selectedReaction ? selectedReaction.label : 'Curtir'}
            </button>
        </div>

        <div className="primary-post-actions">
          <button
            className="social-action-button"
            data-comment-trigger-id={post.id}
            onClick={showCommentsPanel}
          >
            💬 Comentar
          </button>

          <button className="social-action-button share-button" onClick={sharePost}>
            🔄 Compartilhar
          </button>
        </div>
      </footer>
      {shareStatus && <small className="share-status">{shareStatus}</small>}
      {commentsOpen && (
        <section className="comment-panel" data-comment-panel-id={post.id} ref={commentPanelRef}>
          {comments.map((comment) => (
            <article className="comment-item social-comment-card" data-comment-id={comment.id} key={comment.id}>
              <Avatar
                initials={comment.initials ?? getInitials(comment.author)}
                photo={comment.photo}
              />
              {editingCommentId === comment.id ? (
<div
  className="inline-edit-box compact comment-edit-panel"
  data-edit-comment-id={comment.id}
>
  <input
    className="platform-input"
    value={commentEditDraft}
    onChange={(event) => setCommentEditDraft(event.target.value)}
  />

<div className="micro-actions edit-save-actions">
  <button
    className="social-action-button save-action"
    onClick={() => {
      editFeedComment(post.id, comment.id, commentEditDraft);
      setEditingCommentId('');
      scrollToFeedTarget(`[data-comment-id="${comment.id}"]`);
    }}
  >
    💾 Salvar alterações
  </button>

  <button
    className="social-action-button cancel-action"
    onClick={() => setEditingCommentId('')}
  >
    ↩ Cancelar edição
  </button>
</div>
</div>
              ) : (
                <>
                  <div className="comment-bubble">
                    <strong>{comment.author}</strong>
                    <p>{comment.body} {comment.edited && <small className="edited-label">editado</small>}</p>
                    <small>{comment.createdAt ?? 'Agora'}</small>
                  </div>
                  <div className="micro-actions">
<button
  className="social-action-button edit-action"
  onClick={() => {
    setEditingCommentId(comment.id);
    setCommentEditDraft(comment.body);

    setTimeout(() => {
      document
        .querySelector(`[data-edit-comment-id="${comment.id}"]`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    }, 80);
  }}
>
  ✏️ Editar
</button>
<button
  className="social-action-button danger-action"
  onClick={() => {
    const confirmed = window.confirm(
      'Tem certeza que deseja apagar este comentário?',
    );

    if (!confirmed) return;

    deleteFeedComment(post.id, comment.id);
    scrollToFeedTarget(`[data-comment-panel-id="${post.id}"]`);
  }}
>
  🗑️ Apagar
</button>
                  </div>
                </>
              )}
            </article>
          ))}
          <div className="comment-input">
            <Avatar
              initials={currentUser?.initials ?? 'MP'}
              photo={profilePhoto}
            />
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitComment();
                }
              }}
              placeholder="Escreva um comentário e pressione Enter"
            />
            <button className="comment-send-button" onClick={submitComment}>Enviar</button>
          </div>
        </section>
      )}
    </article>
  );
}

// Tela Oportunidades: lista vagas, permite candidatura e criação visual de vaga/freela.
function OpportunitiesView({
  jobs,
  applications,
  applyToJob,
  createJob,
  profileResumeName,
  setProfileResumeName,
  profileResumeDetails,
  setProfileResumeDetails,
  currentUser,
  openPage,
  requestAuthentication,
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('Todas');
  const [applicationJob, setApplicationJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobCreate, setShowJobCreate] = useState(false);
  const [showResumeCreate, setShowResumeCreate] = useState(false);
  const [opportunityNotice, setOpportunityNotice] = useState('');
  const [resumeMode, setResumeMode] = useState('profile');
  const [customResumeName, setCustomResumeName] = useState('currículo importado nesta candidatura');
  const [resumeDraft, setResumeDraft] = useState({
    objective: profileResumeDetails?.objective ?? '',
    experience: profileResumeDetails?.experience ?? '',
    education: profileResumeDetails?.education ?? '',
    skills: profileResumeDetails?.skills ?? '',
    portfolio: profileResumeDetails?.portfolio ?? '',
  });
  const [jobDraft, setJobDraft] = useState({
    title: '',
    company: currentUser?.segment === 'company' ? currentUser.name : '',
    city: 'Remoto',
    type: 'Freela',
    category: 'Profissional',
    salary: '',
    skills: '',
    description: '',
    requirements: '',
    benefits: '',
    rhEmail: '',
    whatsapp: '',
    contactMethods: ['application', 'email'],
  });
  const isCompany = currentUser?.segment === 'company';
  const canRegisterResume = ['student', 'teacher'].includes(currentUser?.segment);
  const opportunityTypeOptions = [
    {
      type: 'CLT',
      category: 'Profissional',
      title: 'Vaga profissional',
      description: 'Contratação CLT, estágio, vaga fixa ou processo seletivo formal.',
    },
    {
      type: 'Freela',
      category: 'Profissional',
      title: 'Freela ou projeto',
      description: 'Demanda pontual, contrato por entrega ou prestação recorrente.',
    },
    {
      type: 'Serviço',
      category: 'Divulgação de serviço',
      title: 'Venda de produto ou serviço',
      description: 'Divulgação comercial, serviço local, produto ou oferta particular.',
    },
    {
      type: 'Espaço',
      category: 'Locação de espaço',
      title: 'Locação de espaço',
      description: 'Sala, auditório, coworking, estúdio ou ambiente para eventos.',
    },
    {
      type: 'Parceria',
      category: 'Parceria comercial',
      title: 'Parceria comercial',
      description: 'Parcerias, afiliados, cupons, negócios locais ou co-marketing.',
    },
  ];
  const selectedOpportunityType =
    opportunityTypeOptions.find((item) => item.type === jobDraft.type) ?? opportunityTypeOptions[0];

  useEffect(() => {
    setResumeDraft({
      objective: profileResumeDetails?.objective ?? '',
      experience: profileResumeDetails?.experience ?? '',
      education: profileResumeDetails?.education ?? '',
      skills: profileResumeDetails?.skills ?? '',
      portfolio: profileResumeDetails?.portfolio ?? '',
    });
  }, [profileResumeDetails]);

  const visibleJobs = jobs.filter((job) => {
    const normalized = search.trim().toLowerCase();
    const matchesSearch =
      !normalized ||
      job.title.toLowerCase().includes(normalized) ||
      job.company.toLowerCase().includes(normalized) ||
      job.city.toLowerCase().includes(normalized) ||
      job.skills.some((skill) => skill.toLowerCase().includes(normalized));
    const matchesType = type === 'Todas' || job.type === type || job.category === type;
    return matchesSearch && matchesType;
  });
  const companyApplications = applications.filter(
    (application) => application.company === currentUser?.name,
  );
  const selectedJobContactMethods = selectedJob ? normalizeOpportunityContactMethods(selectedJob) : [];
  const selectedJobAllowsApplication =
    Boolean(selectedJob) && selectedJobContactMethods.includes('application');
  const selectedJobAllowsWhatsapp = Boolean(selectedJob) && selectedJobContactMethods.includes('whatsapp');
  const selectedJobAllowsEmail = Boolean(selectedJob) && selectedJobContactMethods.includes('email');
  const selectedJobAllowsPlatform = Boolean(selectedJob) && selectedJobContactMethods.includes('platform');
  const selectedJobEmailAction = selectedJob
    ? buildOpportunityEmailAction(selectedJob, currentUser, profileResumeName)
    : null;
  const applicationJobEmailAction = applicationJob
    ? buildOpportunityEmailAction(
        applicationJob,
        currentUser,
        resumeMode === 'profile' ? profileResumeName : customResumeName,
      )
    : null;

  function resetJobDraft() {
    setJobDraft({
      title: '',
      company: currentUser?.segment === 'company' ? currentUser.name : '',
      city: 'Remoto',
      type: 'Freela',
      category: 'Profissional',
      salary: '',
      skills: '',
      description: '',
      requirements: '',
      benefits: '',
      rhEmail: '',
      whatsapp: '',
      contactMethods: ['application', 'email'],
    });
  }

  function selectOpportunityType(option) {
    setJobDraft((current) => {
      const nextDraft = {
        ...current,
        type: option.type,
        category: option.category,
        title: current.title || option.title,
      };
      return {
        ...nextDraft,
        contactMethods: getDefaultOpportunityContactMethods(nextDraft),
      };
    });
  }

  function updateJobType(typeValue) {
    const category = getOpportunityCategoryFromType(typeValue);
    setJobDraft((current) => {
      const nextDraft = {
        ...current,
        type: typeValue,
        category,
      };
      return {
        ...nextDraft,
        contactMethods: getDefaultOpportunityContactMethods(nextDraft),
      };
    });
  }

  function toggleJobContactMethod(methodId) {
    setJobDraft((current) => {
      const currentMethods = normalizeOpportunityContactMethods(current);
      const nextMethods = currentMethods.includes(methodId)
        ? currentMethods.filter((method) => method !== methodId)
        : [...currentMethods, methodId];

      return {
        ...current,
        contactMethods: nextMethods.length > 0 ? nextMethods : [methodId],
      };
    });
  }

  function updateResumeDraft(field, value) {
    setResumeDraft((current) => ({ ...current, [field]: value }));
  }

  function saveManualResume() {
    const hasContent = Object.values(resumeDraft).some((value) => value.trim());
    if (!hasContent) {
      setOpportunityNotice('Preencha ao menos um ponto do currículo antes de salvar.');
      return;
    }
    setProfileResumeDetails({
      mode: 'manual',
      fileName: '',
      ...resumeDraft,
    });
    setProfileResumeName('currículo manual cadastrado');
    setShowResumeCreate(false);
    setOpportunityNotice('Currículo manual salvo para candidaturas.');
  }

  function handleOpportunityEmailClick(event, job, resumeName = profileResumeName) {
    if (!currentUser) {
      event.preventDefault();
      requestAuthentication('entrar em contato por email');
      return;
    }
    const emailAction = buildOpportunityEmailAction(job, currentUser, resumeName);
    if (!emailAction.recipient) {
      event.preventDefault();
      setOpportunityNotice('Esta oportunidade não informou email de contato. Use outro canal disponível.');
      return;
    }

    setOpportunityNotice(
      `Abrindo email para ${emailAction.recipient}. Anexe o currículo antes de enviar, se necessário.`,
    );
  }

  return (
    <section className="opportunities-page">
      {opportunityNotice && (
        <div className="inline-page-notice">
          <strong>{opportunityNotice}</strong>
          <button onClick={() => setOpportunityNotice('')}>Fechar</button>
        </div>
      )}
      <div className="opportunity-layout">
        <section className="opportunity-search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar vaga, cidade, empresa ou habilidade"
          />
          <div className="segmented-row">
            {['Todas', 'Profissional', 'Serviço', 'Espaço', 'Parceria', 'CLT', 'Freela'].map((item) => (
              <button
                className={type === item ? 'active' : ''}
                key={item}
                onClick={() => setType(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {canRegisterResume && (
          <aside className="resume-card">
            <span className="section-kicker">Currículo</span>
            <h3>Currículo da pessoa</h3>
            <p>
              {profileResumeName
                ? `Currículo atual: ${profileResumeName}. Ao se candidatar, você pode usar este cadastro ou importar outro apenas para a vaga.`
                : 'Cadastre um currículo por PDF, Word ou formulário manual para agilizar candidaturas.'}
            </p>
            <button className="action-button profile-action" onClick={() => setShowResumeCreate(true)}>
              {profileResumeName ? 'Atualizar currículo' : 'Cadastrar currículo'}
            </button>
          </aside>
        )}

        {isCompany && (
          <aside className="resume-card company-opportunity-card">
            <span className="section-kicker">Empresa contratante</span>
            <h3>Divulgar oportunidade</h3>
            <p>Publique vaga, freela, venda de serviço, parceria comercial ou locação de espaço.</p>
            <button className="action-button" onClick={() => setShowJobCreate(true)}>
              Criar oportunidade
            </button>
          </aside>
        )}
      </div>

      {isCompany && (
        <section className="company-applications-panel">
          <div>
            <span className="section-kicker">RH da empresa</span>
            <h3>Candidaturas recebidas</h3>
          </div>
          {companyApplications.length === 0 ? (
            <p>Nenhum currículo enviado para suas vagas ainda.</p>
          ) : (
            <div className="application-list">
              {companyApplications.map((application) => (
                <article key={application.id}>
                  <strong>{application.candidateName}</strong>
                  <small>{application.jobTitle} • {application.resumeName}</small>
                  <small>Enviado para: {maskEmail(application.rhEmail)}</small>
                  <div className="button-row">
                    <button
                      onClick={() => {
                        setOpportunityNotice(`Currículo ${application.resumeName} marcado para análise.`);
                        setTimeout(() => {
                          document.querySelector('.company-applications-panel')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }, 80);
                      }}
                    >
                      Avaliar currículo
                    </button>
                    <button
                      className="light"
                      onClick={() => setOpportunityNotice(`Resposta para ${application.candidateName} preparada para envio.`)}
                    >
                      Responder candidato
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="job-grid">
        {visibleJobs.length === 0 ? (
          <section className="empty-state page-empty-state">
            <span className="section-kicker">Oportunidades</span>
            <h3>Nenhuma oportunidade publicada ainda</h3>
            <p>Vagas, serviços, parcerias e espaços aparecerão aqui quando forem cadastrados.</p>
            <button type="button" onClick={() => (currentUser ? setShowJobCreate(true) : openPage('profile'))}>
              {currentUser ? 'Publicar primeira oportunidade' : 'Entrar para publicar'}
            </button>
          </section>
        ) : visibleJobs.map((job) => {
          const contactMethods = normalizeOpportunityContactMethods(job);
          const showApplicationContact = contactMethods.includes('application');
          const showWhatsappContact = contactMethods.includes('whatsapp');
          const showEmailContact = contactMethods.includes('email');
          const showPlatformContact = contactMethods.includes('platform');
          const alreadyApplied = applications.some((application) => application.jobId === job.id);
          const emailAction = buildOpportunityEmailAction(job, currentUser, profileResumeName);
          return (
          <article className="job-card" key={job.id}>
            <header className="compact-card-header">
              <span>{job.category ?? job.type}</span>
              <OptionsMenu
                label={`Opções da vaga ${job.title}`}
                items={[
                  {
                    label: 'Saber mais',
                    description: 'Abrir detalhes da vaga',
                    onClick: () => setSelectedJob(job),
                  },
                  showApplicationContact && {
                    label: applications.some((application) => application.jobId === job.id)
                      ? 'Candidatura enviada'
                      : 'Candidatar-se',
                    description: 'Usar currículo do perfil ou importar outro',
                    disabled: applications.some((application) => application.jobId === job.id),
	                    onClick: () => (currentUser && canRegisterResume
                        ? setApplicationJob(job)
                        : requestAuthentication('candidatar-se à oportunidade')),
                  },
                ]}
              />
            </header>
            <h3>{job.title}</h3>
            <p>{job.company} - {job.city}</p>
            <strong>{job.salary}</strong>
            <div className="tag-row">
              {job.skills.slice(0, 3).map((skill) => <small key={skill}>{skill}</small>)}
              {job.skills.length > 3 && <small>+{job.skills.length - 3}</small>}
            </div>
            <small className="compact-card-meta">
              {job.applicants + (applications.some((application) => application.jobId === job.id) ? 1 : 0)} candidatos
            </small>
            <div className="quick-contact-row">
              <button type="button" onClick={() => setSelectedJob(job)}>Saber mais</button>
              {showApplicationContact && (
                <button
                  type="button"
                  disabled={alreadyApplied}
	                  onClick={() => (currentUser && canRegisterResume
                      ? setApplicationJob(job)
                      : requestAuthentication('candidatar-se à oportunidade'))}
                >
                  {alreadyApplied ? 'Candidatura enviada' : 'Candidatar-se'}
                </button>
              )}
              {showWhatsappContact && (
	                <a
	                  className="contact-channel"
	                  href={`https://wa.me/${onlyDigits(job.whatsapp ?? '')}`}
	                  target="_blank"
	                  rel="noreferrer"
                    onClick={(event) => {
                      if (!currentUser) {
                        event.preventDefault();
                        requestAuthentication('entrar em contato por WhatsApp');
                      }
                    }}
	                >
                  <span aria-hidden="true">☏</span>
                  WhatsApp
                </a>
              )}
              {showEmailContact && (
                <a
                  className="contact-channel"
                  href={emailAction.href || '#'}
                  onClick={(event) => handleOpportunityEmailClick(event, job)}
                  title={
                    emailAction.recipient
                      ? `Enviar email para ${emailAction.recipient}`
                      : 'Email de contato não informado'
                  }
                >
                  <span aria-hidden="true">✉</span>
                  Email
                </a>
              )}
              {showPlatformContact && (
                <button
	                  className="contact-channel"
	                  type="button"
	                  onClick={() => (currentUser
                      ? setOpportunityNotice(`Mensagem interna aberta para ${job.company}.`)
                      : requestAuthentication('enviar mensagem pela plataforma'))}
	                >
                  <span aria-hidden="true">●</span>
                  Mensagem
                </button>
              )}
            </div>
          </article>
          );
        })}
      </div>

      {selectedJob && (
        <div className="floating-backdrop" onClick={() => setSelectedJob(null)}>
          <section className="floating-modal job-detail-modal" onClick={(event) => event.stopPropagation()}>
            <span className="section-kicker">{selectedJob.type}</span>
            <h3>{selectedJob.title}</h3>
            <p>{selectedJob.company} • {selectedJob.city}</p>
            <div className="job-detail-grid">
              <article><strong>Sobre a vaga</strong><p>{selectedJob.description}</p></article>
              <article><strong>O que exige</strong><p>{selectedJob.requirements}</p></article>
              <article><strong>O que oferece</strong><p>{selectedJob.benefits}</p></article>
              {(selectedJobAllowsEmail || selectedJobAllowsApplication) && (
                <article>
                  <strong>Email responsável</strong>
                  <p>{selectedJob.rhEmail || 'Email não informado'}</p>
                  <small>
                    O botão de email abre uma mensagem preenchida. Anexe o currículo no cliente de email antes de enviar.
                  </small>
                </article>
              )}
              {selectedJobAllowsWhatsapp && (
                <article><strong>WhatsApp</strong><p>{selectedJob.whatsapp}</p></article>
              )}
            </div>
            <div className="button-row">
              {selectedJobAllowsApplication && (
	                <button onClick={() => {
                    if (!currentUser || !canRegisterResume) {
                      requestAuthentication('candidatar-se à oportunidade');
                      return;
                    }
                    setApplicationJob(selectedJob);
                    setSelectedJob(null);
                  }}>
                  Candidatar-se
                </button>
              )}
              {selectedJobAllowsWhatsapp && (
	                <a
                    className="button-link"
                    href={`https://wa.me/${onlyDigits(selectedJob.whatsapp ?? '')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!currentUser) {
                        event.preventDefault();
                        requestAuthentication('entrar em contato por WhatsApp');
                      }
                    }}
                  >
                  Chamar no WhatsApp
                </a>
              )}
              {selectedJobAllowsEmail && (
                <a
                  className="button-link light"
                  href={selectedJobEmailAction?.href || '#'}
                  onClick={(event) => handleOpportunityEmailClick(event, selectedJob)}
                >
                  Enviar email
                </a>
              )}
              {selectedJobAllowsPlatform && (
	                <button className="light" onClick={() => (currentUser
                    ? setOpportunityNotice(`Mensagem interna aberta para ${selectedJob.company}.`)
                    : requestAuthentication('enviar mensagem pela plataforma'))}>
                  Mensagem pela plataforma
                </button>
              )}
              <button className="light" onClick={() => setSelectedJob(null)}>Voltar</button>
            </div>
          </section>
        </div>
      )}

      {showResumeCreate && canRegisterResume && (
        <div className="floating-backdrop" onClick={() => setShowResumeCreate(false)}>
          <section className="floating-modal resume-create-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-button" type="button" onClick={() => setShowResumeCreate(false)}>
              Fechar
            </button>
            <span className="section-kicker">Currículo</span>
            <h3>Cadastrar currículo</h3>
            <p>
              Use PDF/Word quando já tiver o arquivo pronto, ou preencha manualmente
              ponto a ponto para deixar o perfil recrutável dentro da plataforma.
            </p>
            <div className="resume-create-options">
              <section>
                <strong>Arquivo pronto</strong>
                <p>PDF, DOC ou DOCX ficam vinculados ao seu perfil para candidaturas.</p>
                <FileUpload
                  label="Currículo em arquivo"
                  action={profileResumeName || 'Enviar PDF ou Word'}
                  accept=".pdf,.doc,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setProfileResumeName(file.name);
                    setProfileResumeDetails({
                      ...createDefaultResumeDetails(),
                      mode: 'file',
                      fileName: file.name,
                    });
                    setOpportunityNotice(`Currículo "${file.name}" vinculado ao perfil.`);
                  }}
                />
              </section>
              <section>
                <strong>Preencher manualmente</strong>
                <p>Complete os principais blocos do currículo sem depender de anexo.</p>
                <div className="manual-resume-grid">
                  <label>
                    Objetivo profissional
                    <textarea
                      value={resumeDraft.objective}
                      onChange={(event) => updateResumeDraft('objective', event.target.value)}
                      placeholder="Área desejada, cargo ou tipo de oportunidade"
                    />
                  </label>
                  <label>
                    Experiências
                    <textarea
                      value={resumeDraft.experience}
                      onChange={(event) => updateResumeDraft('experience', event.target.value)}
                      placeholder="Empresa, função, período e principais entregas"
                    />
                  </label>
                  <label>
                    Formação
                    <textarea
                      value={resumeDraft.education}
                      onChange={(event) => updateResumeDraft('education', event.target.value)}
                      placeholder="Curso, instituição, certificações e ano"
                    />
                  </label>
                  <label>
                    Habilidades
                    <textarea
                      value={resumeDraft.skills}
                      onChange={(event) => updateResumeDraft('skills', event.target.value)}
                      placeholder="Ferramentas, competências, idiomas e tecnologias"
                    />
                  </label>
                  <label>
                    Portfólio ou links
                    <input
                      value={resumeDraft.portfolio}
                      onChange={(event) => updateResumeDraft('portfolio', event.target.value)}
                      placeholder="LinkedIn, GitHub, Behance ou site"
                    />
                  </label>
                </div>
                <button type="button" onClick={saveManualResume}>
                  Salvar currículo manual
                </button>
              </section>
            </div>
            <div className="button-row">
              <button className="light" type="button" onClick={() => setShowResumeCreate(false)}>
                Concluir
              </button>
            </div>
          </section>
        </div>
      )}

      {showJobCreate && (
        <div className="floating-backdrop" onClick={() => setShowJobCreate(false)}>
          <section className="floating-modal job-create-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-button" type="button" onClick={() => setShowJobCreate(false)}>
              Fechar
            </button>
            <span className="section-kicker">Nova oportunidade</span>
            <h3>O que sua empresa quer divulgar?</h3>
            <p>
              Escolha o tipo de oportunidade antes de preencher os detalhes.
              Isso define se o contato será tratado como vaga, venda, parceria ou locação.
            </p>
            <div className="opportunity-type-grid">
              {opportunityTypeOptions.map((option) => (
                <button
                  className={jobDraft.type === option.type ? 'opportunity-choice active' : 'opportunity-choice'}
                  key={option.type}
                  type="button"
                  onClick={() => selectOpportunityType(option)}
                >
                  <strong className="opportunity-choice-title">{option.title}</strong>
                  <small className="opportunity-choice-description">{option.description}</small>
                </button>
              ))}
            </div>
            <p className="policy-note">
              Tipo selecionado: {selectedOpportunityType.title}. Informe descrição, localidade,
              valor e escolha somente os canais que devem aparecer no card.
            </p>
            <div className="contact-method-grid" aria-label="Canais de contato da oportunidade">
              {opportunityContactMethods.map((method) => {
                const isActive = normalizeOpportunityContactMethods(jobDraft).includes(method.id);
                return (
                  <button
                    className={isActive ? 'contact-method-choice active' : 'contact-method-choice'}
                    key={method.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleJobContactMethod(method.id)}
                  >
                    <span className="contact-method-icon" aria-hidden="true">{method.icon}</span>
                    <strong className="contact-method-title">{method.label}</strong>
                    <small className="contact-method-description">{method.description}</small>
                  </button>
                );
              })}
            </div>
            <div className="job-create-grid">
              <label>Título da oportunidade<input value={jobDraft.title} onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Empresa<input value={jobDraft.company} onChange={(event) => setJobDraft((current) => ({ ...current, company: event.target.value }))} /></label>
              <label>Localidade<input value={jobDraft.city} onChange={(event) => setJobDraft((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>Tipo<select value={jobDraft.type} onChange={(event) => updateJobType(event.target.value)}><option>CLT</option><option>Freela</option><option>Estágio</option><option>Serviço</option><option>Espaço</option><option>Parceria</option></select></label>
              <label>Salário ou valor<input value={jobDraft.salary} onChange={(event) => setJobDraft((current) => ({ ...current, salary: event.target.value }))} /></label>
              {(hasOpportunityContactMethod(jobDraft, 'email') || hasOpportunityContactMethod(jobDraft, 'application')) && (
                <label>Email para contato<input value={jobDraft.rhEmail} onChange={(event) => setJobDraft((current) => ({ ...current, rhEmail: event.target.value }))} /></label>
              )}
              {hasOpportunityContactMethod(jobDraft, 'whatsapp') && (
                <label>WhatsApp<input value={jobDraft.whatsapp} onChange={(event) => setJobDraft((current) => ({ ...current, whatsapp: event.target.value }))} /></label>
              )}
              <label>Habilidades<input value={jobDraft.skills} onChange={(event) => setJobDraft((current) => ({ ...current, skills: event.target.value }))} placeholder="React, vendas, atendimento..." /></label>
              <label>Descrição da oportunidade<textarea value={jobDraft.description} onChange={(event) => setJobDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Explique o que será divulgado, vendido, alugado ou contratado." /></label>
              <label>Requisitos ou condições<textarea value={jobDraft.requirements} onChange={(event) => setJobDraft((current) => ({ ...current, requirements: event.target.value }))} /></label>
              <label>Benefícios, diferenciais ou entrega<textarea value={jobDraft.benefits} onChange={(event) => setJobDraft((current) => ({ ...current, benefits: event.target.value }))} /></label>
            </div>
            <div className="button-row">
              <button onClick={() => { createJob(jobDraft); resetJobDraft(); setShowJobCreate(false); }}>Publicar oportunidade</button>
              <button className="light" onClick={() => setShowJobCreate(false)}>Cancelar</button>
            </div>
          </section>
        </div>
      )}

      {applicationJob && (
        <div className="floating-backdrop" onClick={() => setApplicationJob(null)}>
          <section className="floating-modal application-modal" onClick={(event) => event.stopPropagation()}>
            <span className="section-kicker">Candidatura</span>
            <h3>{applicationJob.title}</h3>
            <p>{applicationJob.company} - {applicationJob.city}</p>
            <div className="choice-list">
              <button
                className={resumeMode === 'profile' ? 'active' : ''}
                disabled={!profileResumeName}
                onClick={() => setResumeMode('profile')}
              >
                Usar currículo do perfil
                <small>{profileResumeName || 'Nenhum currículo cadastrado'}</small>
              </button>
              <button
                className={resumeMode === 'custom' ? 'active' : ''}
                onClick={() => setResumeMode('custom')}
              >
                Importar outro arquivo
                <small>Usado somente nesta candidatura</small>
              </button>
            </div>
            {resumeMode === 'custom' && (
              <FileUpload
                label="Currículo para esta vaga"
                action={customResumeName}
                accept=".pdf,.doc,.docx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setCustomResumeName(file.name);
                }}
              />
            )}
            {!currentUser && (
              <p className="policy-note">Entre na conta antes de enviar a candidatura.</p>
            )}
            {hasOpportunityContactMethod(applicationJob, 'email') && (
              <p className="policy-note">
                Email do responsável: {applicationJob.rhEmail || 'não informado'}.
                Ao enviar por email, o navegador abre a mensagem preenchida e você anexa o currículo.
              </p>
            )}
            <div className="button-row">
              <button
                disabled={!currentUser || (resumeMode === 'profile' && !profileResumeName)}
                onClick={() => {
                  applyToJob(
                    applicationJob,
                    resumeMode === 'profile' ? profileResumeName : 'currículo importado nesta candidatura',
                  );
                  setApplicationJob(null);
                }}
              >
                Enviar candidatura
              </button>
              {hasOpportunityContactMethod(applicationJob, 'email') && (
                <a
                  className="button-link light"
                  href={applicationJobEmailAction?.href || '#'}
                  onClick={(event) =>
                    handleOpportunityEmailClick(
                      event,
                      applicationJob,
                      resumeMode === 'profile' ? profileResumeName : customResumeName,
                    )
                  }
                >
                  Enviar por email
                </a>
              )}
              <button className="light" onClick={() => setApplicationJob(null)}>
                Voltar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function BenefitsView({ benefits, redemptions, userPoints, redeemBenefit, currentUser, openPage }) {
  const [category, setCategory] = useState('Todos');
  const hasSubscription = Boolean(currentUser?.subscriptionActive);
  const canCreateBenefits = currentUser?.segment === 'platform';
  const canRequestBenefitPublication = currentUser && !['platform', 'employee'].includes(currentUser.segment);
  const benefitCategories = ['Todos', ...uniqueItems(benefits.map((benefit) => benefit.category))];
  const visibleBenefits = benefits.filter(
    (benefit) => category === 'Todos' || benefit.category === category,
  );

  return (
    <section>
      <div className="benefit-toolbar">
        <strong>
          {currentUser
            ? hasSubscription
              ? `${userPoints} pontos disponíveis`
              : 'Assinatura obrigatória para resgatar cupons'
            : 'Entre para resgatar benefícios'}
        </strong>
        <div className="benefit-toolbar-actions">
          {canCreateBenefits && (
            <button type="button" onClick={() => openPage('profile')}>
              Criar benefício
            </button>
          )}
          {canRequestBenefitPublication && (
            <button className="light" type="button" onClick={() => openPage('rewards')}>
              Quero divulgar benefício
            </button>
          )}
        </div>
        <div className="compact-filter-control">
          <span>{category}</span>
          <OptionsMenu
            label="Filtrar benefícios"
            items={benefitCategories.map((item) => ({
              label: item,
              description: category === item ? 'Filtro selecionado' : 'Aplicar filtro',
              onClick: () => setCategory(item),
            }))}
          />
        </div>
      </div>
      <div className="benefit-grid">
        {visibleBenefits.length === 0 ? (
          <section className="empty-state page-empty-state">
            <span className="section-kicker">Benefícios</span>
            <h3>Nenhum benefício aprovado ainda</h3>
            <p>Benefícios enviados por PF, PJ ou empresas aparecerão aqui após aprovação administrativa.</p>
            {canRequestBenefitPublication && (
              <button type="button" onClick={() => openPage('rewards')}>
                Quero divulgar benefício
              </button>
            )}
          </section>
        ) : visibleBenefits.map((benefit) => {
          const redeemed = redemptions.includes(benefit.id);
          const blocked = !hasSubscription || (userPoints < benefit.pointsCost && !redeemed);
          return (
              <article className={hasSubscription ? 'benefit-card' : 'benefit-card locked'} key={benefit.id}>
              <header className="compact-card-header">
                <span>{benefit.category}</span>
                <strong className="benefit-availability">
                  {hasSubscription && !blocked && !redeemed ? 'Disponível' : redeemed ? 'Resgatado' : 'Bloqueado'}
                </strong>
              </header>
              <h3>{benefit.title}</h3>
              <p>
                {benefit.partner} - {benefit.city}
              </p>
              <strong>{benefit.pointsCost} pontos</strong>
              {hasSubscription && redeemed && (
                <p className="benefit-delivery-note">
                  Enviado por app, email ({maskEmail(getContactEmail(currentUser))}) e WhatsApp.
                </p>
              )}
              <small>
                {benefit.redemptions} resgates registrados
              </small>
              <button
                className="benefit-redeem-button"
                disabled={hasSubscription && (blocked || redeemed)}
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    redeemBenefit(benefit.id);
                    return;
                  }
                  if (hasSubscription) {
                    redeemBenefit(benefit.id);
                    return;
                  }
                  openPage('partners');
                }}
              >
                {!currentUser
                  ? 'Entrar para resgatar'
                  : hasSubscription
                  ? redeemed
                    ? 'Benefício enviado'
                    : blocked
                      ? 'Pontos insuficientes'
                      : 'Resgatar agora'
                  : 'Assinar para resgatar'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Página Pontos: concentra saldo, regras de pontuação, histórico e sugestões de evolução.
function RewardsView({
  userPoints,
  redemptions,
  benefits,
  currentUser,
  openPage,
  requestBenefitPublication,
  benefitRequests = [],
}) {
  const [benefitRequestDraft, setBenefitRequestDraft] = useState({
    title: '',
    partner: '',
    product: '',
    category: 'Serviços',
    city: '',
    pointsCost: '',
    rules: '',
  });
  const [benefitRequestStatus, setBenefitRequestStatus] = useState('');
  const redemptionIds = redemptions ?? [];
  const orderedBenefits = [...benefits].sort((first, second) => first.pointsCost - second.pointsCost);
  const availableBenefits = orderedBenefits.filter((benefit) => !redemptionIds.includes(benefit.id));
  const nextBenefit = availableBenefits.find((benefit) => benefit.pointsCost > userPoints) ?? orderedBenefits[0];
  const nextBenefitCost = nextBenefit?.pointsCost ?? 0;
  const pointsToNextBenefit = Math.max(nextBenefitCost - userPoints, 0);
  const progressToNextBenefit = nextBenefitCost
    ? Math.min(Math.round((userPoints / nextBenefitCost) * 100), 100)
    : 100;
  const currentLevel =
    userPoints >= 1000
      ? 'Embaixador'
      : userPoints >= 500
        ? 'Avançado'
        : userPoints >= 200
          ? 'Ativo'
          : 'Inicial';
  const redeemedBenefits = benefits.filter((benefit) => redemptionIds.includes(benefit.id));
  const canRequestBenefitPublication = currentUser && !['platform', 'employee'].includes(currentUser.segment);
  const userBenefitRequests = benefitRequests.filter(
    (request) => request.requesterEmail === getContactEmail(currentUser),
  );
  const recentPointEvents = [
    {
      title: 'Publicação no feed',
      detail: 'Conteúdo com texto, imagem ou vídeo movimenta a rede regional.',
      value: '+15 pts',
    },
    {
      title: 'Comentário em comunidade',
      detail: 'Interações úteis ajudam a manter comunidades vivas.',
      value: '+8 pts',
    },
    {
      title: 'Conclusão de aula',
      detail: 'O progresso do curso só conta quando a regra da aula é cumprida.',
      value: '+20 pts',
    },
    {
      title: 'Resgate de benefício',
      detail: redeemedBenefits[0]?.title ?? 'Use pontos para liberar cupons e vantagens.',
      value: redeemedBenefits[0] ? `-${redeemedBenefits[0].pointsCost} pts` : 'pendente',
    },
  ];

  function updateBenefitRequestDraft(field, value) {
    setBenefitRequestDraft((current) => ({ ...current, [field]: value }));
  }

  function submitBenefitRequest(event) {
    event.preventDefault();
    const request = requestBenefitPublication?.(benefitRequestDraft);
    if (!request) {
      setBenefitRequestStatus('Informe nome, parceiro, produto e custo em pontos para enviar ao admin.');
      return;
    }
    setBenefitRequestStatus(`Solicitação "${request.title}" enviada para aprovação do administrador.`);
    setBenefitRequestDraft({
      title: '',
      partner: '',
      product: '',
      category: 'Serviços',
      city: '',
      pointsCost: '',
      rules: '',
    });
  }

  return (
    <section className="rewards-page">
      <div className="rewards-hero">
        <section className="points-card rewards-balance-card">
          <span className="section-kicker">Saldo</span>
          <strong>{userPoints}</strong>
          <p>Pontos atuais do usuário</p>
          <div className="reward-level-pill">Nível {currentLevel}</div>
          <small>{redemptionIds.length} benefício(s) resgatado(s)</small>
        </section>

        <section className="points-progress-card">
          <header>
            <div>
              <span className="section-kicker">Próximo benefício</span>
              <h3>{nextBenefit?.title ?? 'Nenhum benefício cadastrado'}</h3>
              <p>
                {pointsToNextBenefit > 0
                  ? `Faltam ${pointsToNextBenefit} pontos para desbloquear esse resgate.`
                  : 'Você já tem pontuação suficiente para resgatar.'}
              </p>
            </div>
            <strong>{progressToNextBenefit}%</strong>
          </header>
          <div className="reward-progress-bar" aria-label="Progresso para o próximo benefício">
            <span style={{ width: `${progressToNextBenefit}%` }} />
          </div>
          <div className="reward-stat-row">
            <div>
              <span>Custo</span>
              <strong>{nextBenefitCost} pts</strong>
            </div>
            <div>
              <span>Parceiro</span>
              <strong>{nextBenefit?.partner ?? 'A definir'}</strong>
            </div>
            <div>
              <span>Categoria</span>
              <strong>{nextBenefit?.category ?? 'Geral'}</strong>
            </div>
          </div>
          <div className="reward-next-actions">
            <button type="button" onClick={() => openPage?.('benefits')}>
              Ver benefícios
            </button>
            <button type="button" className="light" onClick={() => openPage?.('feed')}>
              Ganhar pontos
            </button>
            <button type="button" className="light" onClick={() => openPage?.('events')}>
              Ver encontros
            </button>
          </div>
        </section>
      </div>

      <section className="reward-explainer-grid" aria-label="Como os pontos funcionam">
        <article>
          <span>01</span>
          <strong>Ganhar</strong>
          <p>Cada ação relevante soma pontos. A regra precisa ter limite por dia para evitar uso artificial.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Validar</strong>
          <p>Ações sensíveis, como aula concluída, só pontuam depois de cumprir o critério definido pelo criador.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Resgatar</strong>
          <p>Com saldo suficiente, o assinante troca pontos por cupons, acessos, eventos ou vantagens de parceiros.</p>
        </article>
        <article>
          <span>04</span>
          <strong>Medir</strong>
          <p>Ranking, nível e histórico ajudam a provar engajamento e a vender patrocínios com dados reais.</p>
        </article>
      </section>

      <section className="benefit-request-panel">
        <div>
          <span className="section-kicker">Divulgar benefício</span>
          <h3>{currentUser?.segment === 'platform' ? 'Criar benefício como administrador' : 'Enviar benefício para aprovação'}</h3>
          <p>
            {currentUser?.segment === 'platform'
              ? 'Administradores publicam benefícios diretamente pelo painel central.'
              : 'PF, PJ e empresas enviam a proposta. O benefício só aparece para resgate depois da aprovação administrativa.'}
          </p>
        </div>

        {currentUser?.segment === 'platform' ? (
          <button type="button" onClick={() => openPage?.('profile')}>
            Abrir criação de benefícios
          </button>
        ) : canRequestBenefitPublication ? (
          <form className="benefit-request-form" onSubmit={submitBenefitRequest}>
            <div className="benefit-admin-grid">
              <label>
                Nome do benefício
                <input
                  value={benefitRequestDraft.title}
                  onChange={(event) => updateBenefitRequestDraft('title', event.target.value)}
                  placeholder="Ex: 20% OFF no combo executivo"
                />
              </label>
              <label>
                Empresa/parceiro
                <input
                  value={benefitRequestDraft.partner}
                  onChange={(event) => updateBenefitRequestDraft('partner', event.target.value)}
                  placeholder="Nome da empresa ou profissional"
                />
              </label>
              <label>
                Produto ou serviço
                <input
                  value={benefitRequestDraft.product}
                  onChange={(event) => updateBenefitRequestDraft('product', event.target.value)}
                  placeholder="Ex: Combo executivo, mentoria, voucher"
                />
              </label>
              <label>
                Categoria
                <select
                  value={benefitRequestDraft.category}
                  onChange={(event) => updateBenefitRequestDraft('category', event.target.value)}
                >
                  <option>Alimentação</option>
                  <option>Serviços</option>
                  <option>Eventos</option>
                  <option>Educação</option>
                  <option>Saúde</option>
                  <option>Networking</option>
                </select>
              </label>
              <label>
                Cidade
                <input
                  value={benefitRequestDraft.city}
                  onChange={(event) => updateBenefitRequestDraft('city', event.target.value)}
                  placeholder="Regional, cidade ou online"
                />
              </label>
              <label>
                Custo sugerido em pontos
                <input
                  min="1"
                  type="number"
                  value={benefitRequestDraft.pointsCost}
                  onChange={(event) => updateBenefitRequestDraft('pointsCost', event.target.value)}
                  placeholder="Ex: 120"
                />
              </label>
            </div>
            <label>
              Regras do benefício
              <textarea
                value={benefitRequestDraft.rules}
                onChange={(event) => updateBenefitRequestDraft('rules', event.target.value)}
                placeholder="Informe validade, regras de uso, restrições e como validar o cupom."
              />
            </label>
            <button type="submit">Enviar para aprovação do admin</button>
            {benefitRequestStatus && <p className="valid-note">{benefitRequestStatus}</p>}
          </form>
        ) : (
          <button type="button" onClick={() => openPage?.('profile')}>
            Entrar para divulgar benefício
          </button>
        )}

        {userBenefitRequests.length > 0 && (
          <div className="benefit-request-history">
            <span className="section-kicker">Minhas solicitações</span>
            {userBenefitRequests.map((request) => (
              <article className="platform-record" key={request.id}>
                <span>{request.pointsCost}</span>
                <div>
                  <strong>{request.title}</strong>
                  <small>{request.partner} - {request.product}</small>
                </div>
                <button type="button" disabled>{request.status}</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="reward-action-grid">
        {rewardActions.map((item) => (
          <article className="reward-action-card" key={item.action}>
            <strong>+{item.points}</strong>
            <span>{item.action}</span>
          </article>
        ))}
      </div>

      <div className="reward-content-grid">
        <section className="ranking-card">
          <span className="section-kicker">Ranking regional</span>
          <ol>
            <li>Marina Costa - 1.420 pts</li>
            <li>Rafael Nunes - 1.180 pts</li>
            <li>Você - {userPoints} pts</li>
          </ol>
          <p className="reward-fineprint">
            Sugestão operacional: ranking deve ser separado por período, cidade e comunidade para não favorecer apenas usuários antigos.
          </p>
        </section>

        <section className="reward-history-card">
          <span className="section-kicker">Histórico recente</span>
          <ul className="reward-history-list">
            {recentPointEvents.map((event) => (
              <li key={event.title}>
                <div>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </div>
                <span>{event.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="reward-suggestion-panel">
        <div>
          <span className="section-kicker">Sugestões de melhoria</span>
          <h3>O que eu adicionaria antes de escalar a gamificação</h3>
          <p>
            Pontos sem controle viram inflação. O ideal é transformar a área em um sistema auditável,
            com metas, travas antifraude e dados comerciais para parceiros.
          </p>
        </div>
        <div className="reward-suggestion-grid">
          <article>
            <strong>Missões semanais</strong>
            <p>Exemplo: participar de 1 evento, comentar 3 vezes e concluir 1 aula para ganhar bônus limitado.</p>
          </article>
          <article>
            <strong>Carteira de pontos</strong>
            <p>Registrar entrada, saída, origem, data e regra aplicada. Isso facilita suporte e auditoria.</p>
          </article>
          <article>
            <strong>Antifraude</strong>
            <p>Aplicar cooldown por ação, limite diário e bloqueio de pontuação em conteúdo apagado ou denunciado.</p>
          </article>
          <article>
            <strong>Níveis comerciais</strong>
            <p>Usar status como Inicial, Ativo, Avançado e Embaixador para liberar benefícios melhores.</p>
          </article>
          <article>
            <strong>Ranking segmentado</strong>
            <p>Separar ranking por cidade, comunidade, curso e empresa para aumentar disputa local.</p>
          </article>
          <article>
            <strong>Painel para parceiros</strong>
            <p>Mostrar quantos pontos viraram resgates, visitas, leads e vendas para justificar patrocínio.</p>
          </article>
        </div>
      </section>
    </section>
  );
}

// Tela Parceiros: controla os cards de planos, assinatura e suporte comercial.
function PartnersView({ leads, registerPartnerLead, openPage, openSupport }) {
  const [quoteForm, setQuoteForm] = useState({
    company: '',
    contact: '',
    volume: '',
    message: '',
  });
  const [partnerNotice, setPartnerNotice] = useState('');

  function updateQuote(field, value) {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  }

  function submitQuote(event) {
    event.preventDefault();
    setPartnerNotice(
      `Solicitação recebida. Email automático e mensagem de confirmação enviados para ${quoteForm.contact || 'o contato informado'}.`,
    );
    setQuoteForm({ company: '', contact: '', volume: '', message: '' });
  }

  function openAmbassadorSupport() {
    openSupport?.({
      mode: 'ai',
      subject: 'Suporte ao embaixador',
      status: 'Suporte ao embaixador aberto pela IA.',
      prefill: 'Tenho uma dúvida sobre link, comissão, regras de divulgação ou materiais comerciais.',
      notice:
        'Canal de suporte ao embaixador aberto. Primeiro a IA tenta resolver; se não resolver, clique em "Não resolveu? Chamar pessoa" para abrir atendimento humano.',
    });
    setPartnerNotice(
      'Suporte ao embaixador aberto com IA. Se a resposta não resolver, acione uma pessoa no próprio atendimento.',
    );
  }

  return (
    <section>
      <section className="partners-hero">
        <div>
          <span className="capsule">Monetização da plataforma</span>
          <h2>Planos para assinantes, empresas, patrocinadores e embaixadores.</h2>
          <p>
            Escolha um plano para liberar benefícios, publicar oportunidades,
            vender conteúdo, aparecer em destaque ou atuar como afiliado regional.
          </p>
          <div className="partners-hero-actions">
            <button onClick={() => registerPartnerLead('pj')}>Assinar plano PJ</button>
            <button className="light" onClick={() => registerPartnerLead('pf')}>Assinar PF</button>
          </div>
          <div className="partner-metrics">
            <article>
              <strong>PF</strong>
              <span>benefícios e comunidades</span>
            </article>
            <article>
              <strong>PJ</strong>
              <span>vagas, cupons e conteúdos</span>
            </article>
            <article>
              <strong>VIP</strong>
              <span>patrocínio e destaque</span>
            </article>
          </div>
        </div>
        <aside>
          <span className="section-kicker">Resumo comercial</span>
          <strong>Receita recorrente + publicidade + afiliados</strong>
          <p>O checkout abaixo simula Pix, cartão e boleto para assinatura da plataforma.</p>
        </aside>
      </section>
      <div className="partner-section-heading">
        <div>
          <span className="section-kicker">Planos</span>
          <h3>Escolha o modelo de acesso</h3>
        </div>
        <button onClick={() => openPage('benefits')}>Ver benefícios</button>
      </div>
      <div className="partner-plan-grid">
        {partnerPlans.map((plan) => {
          const details = partnerPlanDetails[plan.id];
          const selected = leads.includes(plan.id);
          return (
          <article
            className={plan.id === 'pj' ? 'partner-plan-card featured' : 'partner-plan-card'}
            key={plan.id}
          >
            <div className="plan-card-top">
              <span>{details.label}</span>
              <small>{details.badge}</small>
            </div>
            <h3>{plan.name}</h3>
            <strong>{plan.price > 0 ? `${formatCurrency(plan.price)}/mês` : 'Comissão'}</strong>
            <p>{plan.description}</p>
            <details className="compact-details">
              <summary>Ver detalhes</summary>
              <p className="plan-audience">{details.audience}</p>
              <ul>
                {details.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            </details>
            <div className="plan-card-actions compact-hint-row">
              <small>{plan.price > 0 ? 'Pix, cartão ou boleto' : 'Validação comercial'}</small>
              <button
                type="button"
                onClick={() => (plan.id === 'ambassador'
                  ? openAmbassadorSupport()
                  : registerPartnerLead(plan.id))}
              >
                {selected ? 'Continuar assinatura' : plan.price > 0 ? 'Assinar agora' : 'Falar com suporte'}
              </button>
            </div>
          </article>
          );
        })}
      </div>

      <section className="monetization-panel">
        <div>
          <span className="section-kicker">Pacotes empresariais</span>
          <h3>Base PJ + cobrança por volume de colaboradores</h3>
          <p>
            Empresas podem publicar vagas, vincular colaboradores, vender cursos,
            operar comunidade própria e oferecer benefícios para assinantes.
          </p>
          <div className="enterprise-tags">
            <span>Colaboradores</span>
            <span>Vagas</span>
            <span>Cursos</span>
            <span>Cupons</span>
          </div>
        </div>
        <button onClick={() => openPage('profile')}>Abrir perfil empresa</button>
      </section>

      <section className="partner-support-grid">
        <article className="partner-support-card">
          <span className="section-kicker">Afiliados</span>
          <h3>Suporte ao embaixador</h3>
          <p>Canal para dúvidas sobre link, comissão, regras de divulgação e materiais comerciais.</p>
          <div className="button-row">
            <button type="button" onClick={openAmbassadorSupport}>
              Abrir suporte
            </button>
            <button className="light" type="button" onClick={() => registerPartnerLead('ambassador')}>
              Quero ser afiliado
            </button>
          </div>
        </article>

        <form className="partner-quote-form" onSubmit={submitQuote}>
          <span className="section-kicker">Grandes volumes</span>
          <h3>Solicitar cotação</h3>
          <label>Empresa<input value={quoteForm.company} onChange={(event) => updateQuote('company', event.target.value)} /></label>
          <label>Email ou WhatsApp<input value={quoteForm.contact} onChange={(event) => updateQuote('contact', event.target.value)} /></label>
          <label>Quantidade estimada<input value={quoteForm.volume} onChange={(event) => updateQuote('volume', event.target.value)} /></label>
          <label>Necessidade<textarea value={quoteForm.message} onChange={(event) => updateQuote('message', event.target.value)} /></label>
          <button type="submit">Enviar cotação</button>
        </form>
      </section>
      {partnerNotice && <p className="inline-page-notice">{partnerNotice}</p>}
    </section>
  );
}

function SubscriptionCheckoutView({ plan, goBack, openPage, currentUser, onSubscriptionPending }) {
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentNotice, setPaymentNotice] = useState('');
  if (!plan) return null;

  const cycleMultiplier = billingCycle === 'annual' ? 10 : billingCycle === 'semiannual' ? 5.5 : 1;
  const basePrice = plan.price > 0 ? plan.price : 0;
  const total = Math.round(basePrice * cycleMultiplier * 100) / 100;
  const cycleLabel = {
    monthly: 'Mensal',
    semiannual: 'Semestral com desconto',
    annual: 'Anual com maior desconto',
  }[billingCycle];
  const paymentLabels = {
    card: 'Cartão',
    pix: 'Pix',
    boleto: 'Boleto',
  };

  async function confirmSubscription() {
    if (!currentUser) {
      setPaymentNotice('Entre na conta antes de iniciar o checkout de assinatura.');
      openPage('profile');
      return;
    }

    let intent = {
      status: plan.price > 0 ? 'PENDING_PAYMENT' : 'PAYMENT_PROCESSING',
      paymentProvider: paymentMethod,
      externalSubscriptionId: `local-${Date.now()}`,
    };
    try {
      intent = await subscriptionRequest('/checkout-intent', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.subscriptionPlanId,
          paymentProvider: paymentMethod,
          billingCycle,
        }),
      });
    } catch {
      // Mantem o fluxo local pendente quando a API nao esta disponivel.
    }

    onSubscriptionPending?.(plan, {
      ...intent,
      paymentProvider: paymentMethod,
    });
    setPaymentNotice(
      plan.price > 0
        ? `Pagamento iniciado. A assinatura ${plan.name} só será ativada após confirmação do webhook do gateway.`
        : 'Cadastro de embaixador enviado para validação comercial. A liberação depende de aprovação.',
    );
  }

  return (
    <section className="checkout-page zoom-in">
      <button className="back-button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Assinatura"
        title={`Assinar ${plan.name}`}
        description="Preencha os dados, escolha ciclo de cobrança e confirme o pagamento da assinatura da plataforma."
      />
      <div className="checkout-grid subscription-grid">
        <section className="profile-card checkout-card buyer-card">
          <span className="section-kicker">Dados da conta</span>
          <h3>{currentUser ? currentUser.name : 'Nova assinatura'}</h3>
          <label>Nome completo ou razao social<input defaultValue={currentUser?.name ?? ''} placeholder="Nome do assinante" /></label>
          <label>Email real para cobrança<input defaultValue={getContactEmail(currentUser)} placeholder="email@dominio.com" /></label>
          <label>CPF/CNPJ<input placeholder="Documento do pagador" /></label>
          <label>Celular<input placeholder="+55 00 00000-0000" /></label>
        </section>

        <section className="profile-card checkout-card payment-card">
          <span className="section-kicker">Pagamento</span>
          <h3>{plan.price > 0 ? formatCurrency(total) : 'Sem cobrança inicial'}</h3>
          {plan.price > 0 && (
            <div className="billing-options">
              {[
                ['monthly', 'Mensal', formatCurrency(plan.price)],
                ['semiannual', 'Semestral', formatCurrency(plan.price * 5.5)],
                ['annual', 'Anual', formatCurrency(plan.price * 10)],
              ].map(([cycle, label, price]) => (
                <button
                  className={billingCycle === cycle ? 'active' : ''}
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                >
                  <strong>{label}</strong>
                  <small>{price}</small>
                </button>
              ))}
            </div>
          )}

          {plan.price > 0 ? (
            <div className="payment-methods">
              {[
                ['pix', 'Pix', 'Liberação rápida'],
                ['card', 'Cartão', 'Crédito recorrente'],
                ['boleto', 'Boleto', 'Compensação bancária'],
              ].map(([method, label, description]) => (
                <button
                  className={paymentMethod === method ? 'active' : ''}
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                >
                  <strong>{label}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="payment-state">
              <strong>Modelo por comissao</strong>
              <p>O embaixador recebe link próprio e passa por validação antes de divulgar.</p>
            </div>
          )}

          {plan.price > 0 && paymentMethod === 'pix' && (
            <div className="payment-state pix-state">
              <strong>Pix da assinatura</strong>
              <div className="qr-box">PIX</div>
              <code>000201meetpoint-assinatura-{plan.id}-{billingCycle}</code>
            </div>
          )}
          {plan.price > 0 && paymentMethod === 'card' && (
            <div className="payment-state">
              <strong>Cartão recorrente</strong>
              <label>Numero do cartão<input placeholder="0000 0000 0000 0000" /></label>
              <div className="payment-inline">
                <label>Validade<input placeholder="MM/AA" /></label>
                <label>CVV<input placeholder="123" /></label>
                <label>Nome<input placeholder="Nome no cartão" /></label>
              </div>
            </div>
          )}
          {plan.price > 0 && paymentMethod === 'boleto' && (
            <div className="payment-state">
              <strong>Boleto da assinatura</strong>
              <label>Vencimento<input type="date" defaultValue="2026-06-20" /></label>
              <p>A assinatura libera após compensação ou webhook do gateway.</p>
            </div>
          )}
          {paymentNotice && <p className="valid-note">{paymentNotice}</p>}
          <button onClick={confirmSubscription}>
            {plan.price > 0 ? `Confirmar ${paymentLabels[paymentMethod]}` : 'Enviar cadastro'}
          </button>
        </section>

        <aside className="checkout-summary subscription-summary">
          <span className="section-kicker">Plano selecionado</span>
          <h3>{plan.name}</h3>
          <p>{plan.description}</p>
          <div>
            <strong>{plan.price > 0 ? formatCurrency(total) : 'Comissão'}</strong>
            <span>{plan.price > 0 ? cycleLabel : 'Sem mensalidade inicial'}</span>
          </div>
          <button onClick={() => openPage('partners')}>Trocar plano</button>
        </aside>
      </div>
    </section>
  );
}

function ExternalCourseLinkCard({ course }) {
  const preview = getExternalCoursePreview(
    course.externalCourseUrl,
    course.externalPlatformName || course.title,
  );
  if (!preview) return null;

  return (
    <a
      className="external-course-link-card"
      href={preview.url}
      target="_blank"
      rel="noreferrer"
    >
      <span className="external-course-thumb">
        {preview.thumbnailUrl ? (
          <img src={preview.thumbnailUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <b>{preview.host.slice(0, 2).toUpperCase()}</b>
        )}
      </span>
      <span>
        <strong>{course.externalPlatformName || preview.title}</strong>
        <small>{preview.host}</small>
      </span>
      <b>↗</b>
    </a>
  );
}

function CoursesView({
  courses,
  selectedCourse,
  selectedCourseId,
  setSelectedCourseId,
  startCheckout,
  enrollments,
  courseProgress,
  createdCourses,
  openPage,
  openCreatedCourse,
  canPublishCourses,
}) {
  // Vitrine de cursos: busca, filtro por tema/preco e selecao do curso ativo.
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('Todos');
  const topicFilters = useMemo(() => getCourseTopicFilters(courses), [courses]);

  const visibleCourses = courses.filter((course) => {
    const search = courseSearch.trim().toLowerCase();
    const matchesSearch =
      !search ||
      course.title.toLowerCase().includes(search) ||
      course.tag.toLowerCase().includes(search) ||
      course.instructor.toLowerCase().includes(search) ||
      normalizeCourseModules(course).some((module) =>
        `${module.title} ${module.objective}`.toLowerCase().includes(search),
      );
    const matchesFilter =
      courseFilter === 'Todos' ||
      (courseFilter === 'Gratuitos' && course.isFree) ||
      (courseFilter === 'Pagos' && !course.isFree) ||
      course.tag === courseFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <section>
      <div className="page-action-row">
        <button
          onClick={() => openPage(canPublishCourses ? 'course-create' : 'profile')}
        >
          {canPublishCourses ? 'Criar curso' : 'Entrar para publicar'}
        </button>
      </div>

      <div className="course-toolbar">
        <input
          value={courseSearch}
          onChange={(event) => setCourseSearch(event.target.value)}
          placeholder="Pesquisar curso, produtor ou tema"
        />
        <div className="compact-filter-control">
          <span>{courseFilter}</span>
          <OptionsMenu
            label="Filtrar cursos"
            items={topicFilters.map((item) => ({
              label: item,
              description: courseFilter === item ? 'Filtro selecionado' : 'Aplicar filtro',
              onClick: () => setCourseFilter(item),
            }))}
          />
        </div>
      </div>

      <div className="product-grid">
        {visibleCourses.length === 0 ? (
          <p className="empty-state">Nenhum curso encontrado com esses filtros.</p>
        ) : visibleCourses.map((course) => {
          const modules = normalizeCourseModules(course);
          const externalPreview = getExternalCoursePreview(
            course.externalCourseUrl,
            course.externalPlatformName || course.title,
          );
          return (
            <button
              className={
                selectedCourseId === course.id
                  ? `product-card active ${course.color}`
                  : `product-card ${course.color}`
              }
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
            >
              <span className="pill">{course.tag}</span>
              {course.deliveryMode === 'external' && externalPreview ? (
                <div className={`mock-product external-course-preview ${externalPreview.thumbnailUrl ? 'has-thumbnail' : ''}`}>
                  {externalPreview.thumbnailUrl ? (
                    <img src={externalPreview.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <strong>{externalPreview.host.slice(0, 2).toUpperCase()}</strong>
                  )}
                  <span>{externalPreview.host}</span>
                </div>
              ) : (
                <div className="mock-product">
                  <strong>{course.isFree ? 'FREE' : `R$${course.price}`}</strong>
                </div>
              )}
              <h3>{course.title}</h3>
              <div className="course-card-meta compact">
                {course.deliveryMode === 'external' ? (
                  <>
                    <span>Divulgação externa</span>
                    <span>{externalPreview?.host ?? 'Link externo'}</span>
                  </>
                ) : (
                  <>
                    <span>{modules.length} módulo(s)</span>
                    <span>{getCourseLessonCount(course)} aula(s)</span>
                  </>
                )}
              </div>
              {(courseProgress[course.id] ?? 0) > 0 && (
                <small>{courseProgress[course.id]}% concluído</small>
              )}
            </button>
          );
        })}
      </div>

      {selectedCourse ? (
        <aside className={`detail-panel ${selectedCourse.color}`}>
          <div>
            <span className="section-kicker">Curso selecionado</span>
            <h2>{selectedCourse.title}</h2>
            <p>
              Produtor: {selectedCourse.instructor}. Publicação: {selectedCourse.company}.
              Aula ao vivo: {formatDateTime(selectedCourse.liveDate)}.
            </p>
            {selectedCourse.deliveryMode === 'external' ? (
              <ExternalCourseLinkCard course={selectedCourse} />
            ) : (
              <div className="course-detail-curriculum">
                {normalizeCourseModules(selectedCourse).slice(0, 4).map((module, index) => (
                  <article key={module.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{module.title}</strong>
                    <small>{module.lessons.length} aula(s) • {module.release}</small>
                  </article>
                ))}
              </div>
            )}
            {!selectedCourse.isFree && (
              <p className="policy-note">
                A plataforma retém {selectedCourse.platformFeePercent}% de cada venda
                como taxa operacional. O restante fica disponível ao produtor.
              </p>
            )}
          </div>
          {selectedCourse.deliveryMode === 'external' && selectedCourse.externalCourseUrl ? (
            <button onClick={() => window.open(normalizeExternalUrl(selectedCourse.externalCourseUrl), '_blank', 'noopener,noreferrer')}>
              Acessar plataforma externa
            </button>
          ) : (
            <button onClick={() => startCheckout(selectedCourse.id)}>
              {enrollments.includes(selectedCourse.id)
                ? 'Ver no perfil'
                : selectedCourse.isFree
                  ? 'Inscrever grátis'
                  : `Comprar por R$ ${selectedCourse.price}`}
            </button>
          )}
        </aside>
      ) : (
        <aside className="detail-panel empty-detail-panel">
          <span className="section-kicker">Cursos</span>
          <h2>Nenhum curso publicado ainda</h2>
          <p>Quando uma Pessoa Jurídica ou empresa publicar o primeiro curso, ele aparecerá aqui.</p>
          <button type="button" onClick={() => openPage(canPublishCourses ? 'course-create' : 'profile')}>
            {canPublishCourses ? 'Criar primeiro curso' : 'Entrar para publicar'}
          </button>
        </aside>
      )}

      <section className="created-courses-section">
        <span className="section-kicker">Meus cursos criados</span>
        {createdCourses.length === 0 ? (
          <p className="empty-state">Nenhum curso criado ainda.</p>
        ) : (
          <div className="created-course-list">
            {createdCourses.map((course) => {
              const issues = course.published ? [] : getCoursePublicationIssues(course);
              const visibleIssues = issues.slice(0, 3);
              return (
                <button
                  className={`created-course-card ${course.published ? course.color : 'draft-neutral'} ${course.published ? 'published' : 'draft'}`}
                  key={course.id}
                  onClick={() => openCreatedCourse(course.id)}
                >
                  <strong>{course.title || 'Curso sem nome'}</strong>
                  <span className="created-course-status">{course.published ? 'Publicado' : 'Rascunho'}</span>
                  <small>
                    {course.tag || 'Tema pendente'} • {course.isFree ? 'Gratuito' : `R$ ${course.price || 0}`}
                  </small>
                  <small>
                    {course.updatedAt || course.createdAt
                      ? `Atualizado: ${formatDateTime(course.updatedAt ?? course.createdAt)}`
                      : 'Criado nesta sessão'}
                  </small>
                  {!course.published && issues.length > 0 && (
                    <div className="created-course-missing">
                      <span>Falta completar</span>
                      {visibleIssues.map((issue) => (
                        <small key={issue.id}>{issue.label}</small>
                      ))}
                      {issues.length > visibleIssues.length && (
                        <small>+{issues.length - visibleIssues.length} item(ns)</small>
                      )}
                    </div>
                  )}
                  <span className="created-course-action">Continuar edição</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

// Criacao de curso: coleta dados comerciais, tema, preco e grade inicial.
function CreateCourseView({ createCourse, currentUser, goBack }) {
  const [pricingMode, setPricingMode] = useState('free');
  const isStudent = currentUser?.segment === 'student';
  const isTeacher = currentUser?.segment === 'teacher';
  const isCompany = currentUser?.segment === 'company';
  const linkedCompanies = currentUser?.companyLinks ?? [];
  const hasLinkedCompany = linkedCompanies.length > 0;
  const [publicationMode, setPublicationMode] = useState(
    isTeacher && hasLinkedCompany ? 'company' : 'autonomous',
  );
  const [form, setForm] = useState({
    title: '',
    topic: 'Tecnologia',
    customTopic: '',
    description: '',
    price: '497',
    liveDate: '2026-06-20T19:00',
    linkedCompany: linkedCompanies[0] ?? '',
    deliveryMode: 'internal',
    externalCourseUrl: '',
    externalPlatformName: '',
  });
  const [modules, setModules] = useState([
    {
      id: 'draft-module-1',
      title: 'Módulo 1 - Fundamentos',
      objective: 'Apresentar contexto, promessa do curso e primeiros passos.',
      release: 'Liberação imediata',
      lessons: [
        {
          id: 'draft-lesson-1',
          title: 'Boas-vindas e visão geral',
          type: 'Vídeo',
          duration: '12 min',
          unlockRule: 'Assistir 80% do vídeo',
          material: 'PDF de apoio',
          videoUrl: '',
          attachmentUrl: '',
          assignment: '',
        },
        {
          id: 'draft-lesson-2',
          title: 'Primeira tarefa prática',
          type: 'Tarefa',
          duration: '30 min',
          unlockRule: 'Enviar tarefa',
          material: 'Template editável',
          videoUrl: '',
          attachmentUrl: '',
          assignment: 'Envie a primeira atividade prática do módulo.',
        },
      ],
    },
  ]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'email') {
      setEmailVerificationSent(false);
      setSignupNotice('');
    }
  }

  function updateModule(moduleId, field, value) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId ? { ...module, [field]: value } : module,
      ),
    );
  }

  function updateLesson(moduleId, lessonId, field, value) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, [field]: value } : lesson,
              ),
            }
          : module,
      ),
    );
  }

  function addModule() {
    const nextNumber = modules.length + 1;
    setModules((current) => [
      ...current,
      {
        id: `draft-module-${Date.now()}`,
        title: `Módulo ${nextNumber}`,
        objective: 'Descreva o objetivo deste módulo.',
        release: 'Após concluir módulo anterior',
        lessons: [],
      },
    ]);
  }

  function addLesson(moduleId) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: [
                ...module.lessons,
                {
                  id: `draft-lesson-${Date.now()}`,
                  title: `Nova aula ${module.lessons.length + 1}`,
                  type: 'Vídeo',
                  duration: '15 min',
                  unlockRule: 'Assistir 80% do vídeo',
                  material: 'Material complementar',
                  videoUrl: '',
                  attachmentUrl: '',
                  assignment: '',
                },
              ],
            }
          : module,
      ),
    );
  }

  function removeLesson(moduleId, lessonId) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: module.lessons.filter((lesson) => lesson.id !== lessonId) }
          : module,
      ),
    );
  }

  const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);
  const selectedTopic = resolveCourseTopic(form.topic, form.customTopic);
  const draftCourseForValidation = {
    ...form,
    title: form.title,
    tag: selectedTopic,
    topic: selectedTopic,
    isFree: pricingMode === 'free',
    price: pricingMode === 'free' ? 0 : Number(form.price || 0),
    deliveryMode: form.deliveryMode,
    externalCourseUrl: form.externalCourseUrl,
    modules,
  };
  const creationIssues = getCoursePublicationIssues(draftCourseForValidation, modules);
  const creationIssueIds = new Set(creationIssues.map((issue) => issue.id));
  const hasCreationIssue = (issueId) => creationIssueIds.has(issueId);

  return (
    <section className="zoom-in">
      <button className="back-button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Novo curso"
        title="Cadastrar e estruturar o curso"
        description="Monte o rascunho com módulos, aulas, materiais, tarefas e regra de avanço. Depois você pode continuar refinando antes de publicar."
      />
      <div className="course-create-stats">
        <article><strong>{modules.length}</strong><span>Módulos</span></article>
        <article><strong>{lessonCount}</strong><span>Aulas e tarefas</span></article>
        <article><strong>{pricingMode === 'free' ? 'Grátis' : formatCurrency(Number(form.price || 0))}</strong><span>Oferta</span></article>
      </div>

      <div className="create-course-form advanced-course-form">
        <section className="builder-card">
          <span className="section-kicker">Informações do curso</span>
          <label className={hasCreationIssue('course-title') ? 'required-missing' : ''}>
            Nome do curso
            <input
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Ex: Curso completo de comunidade"
            />
          </label>
          <label className={hasCreationIssue('course-topic') ? 'required-missing' : ''}>
            Tema do curso
            <select
              value={form.topic}
              onChange={(event) => update('topic', event.target.value)}
            >
              {courseTopicOptions.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </label>
          {form.topic === 'Outro tema' && (
            <label>
              Digite o tema do curso
              <input
                value={form.customTopic}
                onChange={(event) => update('customTopic', event.target.value)}
                placeholder="Ex: Marketing, vendas, design, direito..."
              />
            </label>
          )}
          <label className={hasCreationIssue('course-description') ? 'required-missing' : ''}>
            Descrição
            <textarea
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Explique o que a pessoa vai aprender"
            />
          </label>
          <div className="course-implementation-note">
            <strong>Estrutura recomendada</strong>
            <p>Use módulos curtos, aula com objetivo claro, tema bem definido, material de apoio e uma regra objetiva para liberar a próxima etapa.</p>
          </div>
          <div className="course-implementation-note external-course-mode-panel">
            <strong>Modelo de entrega</strong>
            <p>
              Hospede o curso dentro da MeetPoint ou use esta área para divulgar
              um curso que já está em outra plataforma.
            </p>
            <div className="pricing-switch">
              <button
                className={form.deliveryMode === 'internal' ? 'active' : ''}
                type="button"
                onClick={() => update('deliveryMode', 'internal')}
              >
                Curso interno
              </button>
              <button
                className={form.deliveryMode === 'external' ? 'active' : ''}
                type="button"
                onClick={() => update('deliveryMode', 'external')}
              >
                Divulgação externa
              </button>
            </div>
            {form.deliveryMode === 'external' && (
              <>
                <label className={hasCreationIssue('course-external-url') ? 'required-missing' : ''}>
                  Link da plataforma externa
                  <input
                    id="course-external-url-field"
                    value={form.externalCourseUrl}
                    onChange={(event) => update('externalCourseUrl', event.target.value)}
                    placeholder="https://hotmart.com/... ou https://youtube.com/..."
                  />
                </label>
                <label>
                  Nome da plataforma
                  <input
                    value={form.externalPlatformName}
                    onChange={(event) => update('externalPlatformName', event.target.value)}
                    placeholder="Hotmart, Eduzz, Kiwify, YouTube..."
                  />
                </label>
                {getExternalCoursePreview(form.externalCourseUrl, form.externalPlatformName || form.title) && (
                  <ExternalCourseLinkCard
                    course={{
                      title: form.title || 'Curso externo',
                      externalCourseUrl: form.externalCourseUrl,
                      externalPlatformName: form.externalPlatformName,
                    }}
                  />
                )}
              </>
            )}
          </div>
          {isStudent && (
            <div className="course-implementation-note">
              <strong>Publicação da Pessoa Física</strong>
              <p>
                Você pode criar curso como PF. Se o curso for pago, a plataforma
                mantém a taxa operacional e libera saque somente após validação
                documental e configuração financeira.
              </p>
            </div>
          )}
          {isTeacher && (
            <div className="course-implementation-note">
              <strong>Publicação da Pessoa Jurídica</strong>
              <p>
                Você pode publicar este curso como PJ autônoma. Se estiver
                vinculado a uma empresa, também pode escolher publicar conectado a ela.
              </p>
              <div className="pricing-switch teacher-publish-switch">
                <button
                  className={publicationMode === 'autonomous' ? 'active' : ''}
                  type="button"
                  onClick={() => setPublicationMode('autonomous')}
                >
                  PJ autônoma
                </button>
                <button
                  className={publicationMode === 'company' ? 'active' : ''}
                  disabled={!hasLinkedCompany}
                  type="button"
                  onClick={() => setPublicationMode('company')}
                >
                  Empresa vinculada
                </button>
              </div>
              {publicationMode === 'company' && hasLinkedCompany ? (
                <label>
                  Empresa vinculada ao curso
                  <select
                    value={form.linkedCompany}
                    onChange={(event) => update('linkedCompany', event.target.value)}
                  >
                    {linkedCompanies.map((company) => (
                      <option key={company}>{company}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="policy-note">
                  Sem vínculo obrigatório: o curso sairá como publicação autônoma
                  da Pessoa Jurídica. Vínculo com empresa pode ser solicitado depois no perfil.
                </p>
              )}
            </div>
          )}
          {isCompany && (
            <div className="course-implementation-note">
              <strong>Publicação da empresa</strong>
              <p>
                O curso sairá vinculado à conta empresarial. Depois do rascunho,
                você pode adicionar módulos, aulas, materiais, professores e regras
                de conclusão antes de publicar.
              </p>
            </div>
          )}
        </section>

        <section className="builder-card">
          <span className="section-kicker">Preço e aula ao vivo</span>
          <div className="pricing-switch">
            <button
              className={pricingMode === 'free' ? 'active' : ''}
              type="button"
              onClick={() => setPricingMode('free')}
            >
              Gratuito
            </button>
            <button
              className={pricingMode === 'paid' ? 'active' : ''}
              type="button"
              onClick={() => setPricingMode('paid')}
            >
              Pago
            </button>
          </div>
          {pricingMode === 'paid' && (
            <>
              <label className={hasCreationIssue('course-price') ? 'required-missing' : ''}>
                Valor do curso
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  min="1"
                />
              </label>
              <div className="fee-preview">
                <strong>Taxa da plataforma: {PLATFORM_FEE_PERCENT}%</strong>
                <span>
                  Em uma venda de {formatCurrency(Number(form.price || 0))}, a plataforma
                  recebe {formatCurrency(calculatePlatformSplit(form.price).platformFee)}
                  {' '}e o produtor recebe {formatCurrency(calculatePlatformSplit(form.price).producerNet)}.
                </span>
              </div>
            </>
          )}
          <label>
            Primeira aula ao vivo
            <input
              type="datetime-local"
              value={form.liveDate}
              onChange={(event) => update('liveDate', event.target.value)}
            />
          </label>
          <div className={creationIssues.length ? 'course-create-missing-panel' : 'course-create-ready-panel'}>
            <strong>{creationIssues.length ? 'Falta completar' : 'Rascunho com base preenchida'}</strong>
            {creationIssues.length ? (
              creationIssues.slice(0, 6).map((issue) => (
                <span key={issue.id}>{issue.label}: {issue.detail}</span>
              ))
            ) : (
              <span>Informações mínimas prontas para abrir o builder e publicar depois.</span>
            )}
            {creationIssues.length > 6 && (
              <span>+{creationIssues.length - 6} pendência(s) no restante da estrutura.</span>
            )}
          </div>
          <button
            onClick={() =>
              createCourse({
                ...form,
                category: selectedTopic,
                topic: selectedTopic,
                isFree: pricingMode === 'free',
                publicationMode,
                linkedCompany: publicationMode === 'company' ? form.linkedCompany : '',
                deliveryMode: form.deliveryMode,
                externalCourseUrl: form.externalCourseUrl,
                externalPlatformName: form.externalPlatformName,
                modules,
              })
            }
          >
            Criar rascunho do curso
          </button>
        </section>
      </div>

      <section className="course-module-planner">
        <div className="module-planner-header">
          <div>
            <span className="section-kicker">Grade do curso</span>
            <h3>Módulos, aulas, materiais e regras de avanço</h3>
          </div>
          <button onClick={addModule}>Adicionar módulo</button>
        </div>

        <div className="module-planner-list">
          {modules.map((module, moduleIndex) => (
            <article
              className={
                creationIssues.some((issue) => issue.id.startsWith(`${module.id}-`))
                  ? 'module-builder-card required-missing'
                  : 'module-builder-card'
              }
              key={module.id}
            >
              <header>
                <span>{String(moduleIndex + 1).padStart(2, '0')}</span>
                <div>
                  <input
                    value={module.title}
                    onChange={(event) => updateModule(module.id, 'title', event.target.value)}
                  />
                  <textarea
                    value={module.objective}
                    onChange={(event) => updateModule(module.id, 'objective', event.target.value)}
                  />
                </div>
                <select
                  value={module.release}
                  onChange={(event) => updateModule(module.id, 'release', event.target.value)}
                >
                  <option>Liberação imediata</option>
                  <option>Após concluir módulo anterior</option>
                  <option>Liberação semanal</option>
                  <option>Data programada</option>
                </select>
              </header>

              <div className="lesson-builder-list">
                {module.lessons.map((lesson, lessonIndex) => (
                  <section
                    className={
                      creationIssues.some((issue) => issue.id.startsWith(`${lesson.id}-`))
                        ? 'lesson-builder-row required-missing'
                        : 'lesson-builder-row'
                    }
                    key={lesson.id}
                  >
                    <span>{lessonIndex + 1}</span>
                    <input
                      value={lesson.title}
                      onChange={(event) => updateLesson(module.id, lesson.id, 'title', event.target.value)}
                    />
                    <select
                      value={lesson.type}
                      onChange={(event) => updateLesson(module.id, lesson.id, 'type', event.target.value)}
                    >
                      <option>Vídeo</option>
                      <option>Texto</option>
                      <option>Tarefa</option>
                      <option>Live</option>
                      <option>Material</option>
                    </select>
                    <input
                      value={lesson.duration}
                      onChange={(event) => updateLesson(module.id, lesson.id, 'duration', event.target.value)}
                      placeholder="Duração"
                    />
                    <input
                      value={lesson.unlockRule}
                      onChange={(event) => updateLesson(module.id, lesson.id, 'unlockRule', event.target.value)}
                      placeholder="Regra para avançar"
                    />
                    <input
                      value={lesson.material}
                      onChange={(event) => updateLesson(module.id, lesson.id, 'material', event.target.value)}
                      placeholder="Material"
                    />
                    <button onClick={() => removeLesson(module.id, lesson.id)}>Remover</button>
                  </section>
                ))}
              </div>

              <button className="add-lesson-button" onClick={() => addLesson(module.id)}>
                Adicionar aula neste módulo
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function AccessGate({ title, description, goBack, openPage }) {
  return (
    <section className="zoom-in">
      <button className="back-button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Acesso protegido"
        title={title}
        description={description}
      />
      <section className="profile-card access-gate-card">
        <span className="section-kicker">Permissão necessária</span>
        <h3>Entre com o perfil correto</h3>
        <p>
          Essa área altera dados de venda, conteúdo ou publicação. Ela fica
          bloqueada para visitantes e perfis sem permissão.
        </p>
        <button onClick={() => openPage('profile')}>Ir para login/perfil</button>
      </section>
    </section>
  );
}

function CourseBuilderView({
  course,
  goBack,
  openPage,
  openMediaViewer,
  publishCreatedCourse,
  updateCreatedCourse,
  updateCreatedCourseModules,
}) {
  // Implementacao do curso: editor completo de modulos, aulas, materiais e checklist.
  const [publishNotice, setPublishNotice] = useState('');

  if (!course) {
    return (
      <section className="zoom-in">
        <button className="back-button" onClick={() => goBack('courses')}>Voltar para cursos</button>
        <PageHeader
          label="Implementar curso"
          title="Selecione um curso criado"
          description="Para implementar módulos, aulas, materiais e regras de avanço, abra um rascunho em Meus cursos criados."
        />
        <p className="empty-state">Nenhum rascunho de curso está selecionado nesta sessão.</p>
      </section>
    );
  }
  const modules = normalizeCourseModules(course);

  function updateCourse(patch) {
    updateCreatedCourse(course.id, patch);
    setPublishNotice('');
  }

  function updateModules(nextModules) {
    updateCreatedCourseModules(course.id, nextModules);
    setPublishNotice('');
  }

  function updateModule(moduleId, field, value) {
    updateModules(
      modules.map((module) =>
        module.id === moduleId ? { ...module, [field]: value } : module,
      ),
    );
  }

  function updateLesson(moduleId, lessonId, field, value) {
    updateModules(
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, [field]: value } : lesson,
              ),
            }
          : module,
      ),
    );
  }

  function addModule() {
    updateModules([
      ...modules,
      {
        id: `module-${Date.now()}`,
        title: `Módulo ${modules.length + 1}`,
        objective: 'Descreva o resultado esperado deste módulo.',
        release: 'Após concluir módulo anterior',
        lessons: [],
      },
    ]);
  }

  function addLesson(moduleId) {
    updateModules(
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: [
                ...module.lessons,
                {
                  id: `lesson-${Date.now()}`,
                  title: `Nova aula ${module.lessons.length + 1}`,
                  type: 'Vídeo',
                  duration: '15 min',
                  unlockRule: 'Assistir 80% do vídeo',
                  material: 'Material complementar',
                  videoUrl: '',
                  attachmentUrl: '',
                  assignment: '',
                },
              ],
            }
          : module,
      ),
    );
  }

  function removeLesson(moduleId, lessonId) {
    updateModules(
      modules.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: module.lessons.filter((lesson) => lesson.id !== lessonId) }
          : module,
      ),
    );
  }

  const lessonCount = getCourseLessonCount(course);
  const publicationIssues = getCoursePublicationIssues(course, modules);
  const readyToPublish = publicationIssues.length === 0;
  const topicIsListed = courseTopicOptions.includes(course.tag);
  const selectedTopicValue = topicIsListed ? course.tag : 'Outro tema';
  const checklist = [
    {
      label: 'Informações comerciais',
      done: !publicationIssues.some((issue) => issue.id.startsWith('course-')),
    },
    {
      label: 'Módulos com objetivo',
      done: modules.length > 0 && !publicationIssues.some((issue) => issue.id.includes('-objective') || issue.id.includes('-lessons')),
    },
    {
      label: 'Aulas com conteúdo implementado',
      done: lessonCount > 0 && !publicationIssues.some((issue) =>
        issue.id.includes('-video') ||
        issue.id.includes('-material-url') ||
        issue.id.includes('-assignment'),
      ),
    },
    {
      label: 'Regra de avanço por aula',
      done: lessonCount > 0 && !publicationIssues.some((issue) => issue.id.includes('-unlock')),
    },
  ];

  function scrollToPublicationTarget(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handlePublishCourse() {
    if (!readyToPublish) {
      setPublishNotice(`Ainda falta resolver ${publicationIssues.length} item(ns) antes de publicar.`);
      scrollToPublicationTarget(publicationIssues[0]?.targetId);
      return;
    }

    publishCreatedCourse(course.id);
    setPublishNotice('Curso pronto e publicado na vitrine.');
  }

  return (
    <section className="zoom-in">
      <button className="back-button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Implementar curso"
        title={course.title}
        description="Monte a programação do curso, adicione aulas, materiais, lives e publique quando estiver pronto."
      />
      <div className="course-builder-dashboard">
        <article><strong>{modules.length}</strong><span>Módulos</span></article>
        <article><strong>{lessonCount}</strong><span>Aulas</span></article>
        <article><strong>{getCourseWorkloadLabel(course)}</strong><span>Carga estimada</span></article>
        <article><strong>{course.published ? 'Publicado' : 'Rascunho'}</strong><span>Status</span></article>
      </div>

      <div className="course-builder-layout">
        <section className="course-module-planner builder-mode">
          <div className="course-settings-grid">
            <section className="course-settings-card">
              <span className="section-kicker">Dados do curso</span>
              <label id="course-title-field">
                Nome do curso
                <input
                  value={course.title}
                  onChange={(event) => updateCourse({ title: event.target.value })}
                  placeholder="Nome comercial do curso"
                />
              </label>
              <label id="course-description-field">
                Descrição para venda
                <textarea
                  value={course.description ?? ''}
                  onChange={(event) => updateCourse({ description: event.target.value })}
                  placeholder="Resultado que a pessoa vai alcançar, público ideal e formato de entrega"
                />
              </label>
              <p className="policy-note">
                Publicação: {course.publicationScope ?? 'Produtor'} - {course.company ?? 'Sem vínculo empresarial'}.
              </p>
            </section>

            <section className="course-settings-card">
              <span className="section-kicker">Oferta</span>
              <label id="course-topic-field">
                Tema do curso
                <select
                  value={selectedTopicValue}
                  onChange={(event) =>
                    updateCourse({
                      tag: event.target.value === 'Outro tema'
                        ? ''
                        : event.target.value,
                      topic: event.target.value === 'Outro tema'
                        ? ''
                        : event.target.value,
                    })
                  }
                >
                  {courseTopicOptions.map((topic) => (
                    <option key={topic}>{topic}</option>
                  ))}
                </select>
              </label>
              {selectedTopicValue === 'Outro tema' && (
                <label>
                  Digite o tema
                  <input
                    value={topicIsListed ? '' : course.tag ?? ''}
                    onChange={(event) => updateCourse({
                      tag: event.target.value,
                      topic: event.target.value,
                    })}
                    placeholder="Ex: Marketing, vendas, jurídico, gastronomia..."
                  />
                </label>
              )}
              <div className="pricing-switch">
                <button
                  className={course.isFree ? 'active' : ''}
                  type="button"
                  onClick={() => updateCourse({ isFree: true, price: 0, platformFeePercent: 0 })}
                >
                  Gratuito
                </button>
                <button
                  className={!course.isFree ? 'active' : ''}
                  type="button"
                  onClick={() =>
                    updateCourse({
                      isFree: false,
                      price: Number(course.price || 497),
                      platformFeePercent: PLATFORM_FEE_PERCENT,
                    })
                  }
                >
                  Pago
                </button>
              </div>
              {!course.isFree && (
                <label id="course-price-field">
                  Valor do curso
                  <input
                    type="number"
                    min="1"
                    value={course.price}
                    onChange={(event) => updateCourse({ price: Number(event.target.value || 0) })}
                  />
                </label>
              )}
              <label>
                Próxima aula ao vivo
                <input
                  type="datetime-local"
                  value={course.liveDate}
                  onChange={(event) => updateCourse({ liveDate: event.target.value })}
                />
              </label>
            </section>
          </div>

          <div className="module-planner-header">
            <div>
              <span className="section-kicker">Programação</span>
              <h3>Estrutura curricular</h3>
            </div>
            <button onClick={addModule}>Adicionar módulo</button>
          </div>

          <div className="module-planner-list" id="course-module-list">
            {modules.map((module, moduleIndex) => (
              <article className="module-builder-card" id={`module-card-${module.id}`} key={module.id}>
                <header>
                  <span>{String(moduleIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <input
                      value={module.title}
                      onChange={(event) => updateModule(module.id, 'title', event.target.value)}
                    />
                    <textarea
                      value={module.objective}
                      onChange={(event) => updateModule(module.id, 'objective', event.target.value)}
                    />
                  </div>
                  <select
                    value={module.release}
                    onChange={(event) => updateModule(module.id, 'release', event.target.value)}
                  >
                    <option>Liberação imediata</option>
                    <option>Após concluir módulo anterior</option>
                    <option>Liberação semanal</option>
                    <option>Data programada</option>
                  </select>
                </header>

                <div className="lesson-builder-list">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <section className="lesson-builder-row" id={`lesson-card-${lesson.id}`} key={lesson.id}>
                      <div className="lesson-builder-main">
                        <span>{lessonIndex + 1}</span>
                        <input
                          value={lesson.title}
                          onChange={(event) => updateLesson(module.id, lesson.id, 'title', event.target.value)}
                          placeholder="Título da aula"
                        />
                        <select
                          value={lesson.type}
                          onChange={(event) => updateLesson(module.id, lesson.id, 'type', event.target.value)}
                        >
                          <option>Vídeo</option>
                          <option>Texto</option>
                          <option>Tarefa</option>
                          <option>Live</option>
                          <option>Material</option>
                        </select>
                        <input
                          value={lesson.duration}
                          onChange={(event) => updateLesson(module.id, lesson.id, 'duration', event.target.value)}
                          placeholder="Duração"
                        />
                        <button onClick={() => removeLesson(module.id, lesson.id)}>Remover</button>
                      </div>

                      <div className="lesson-builder-details">
                        <label>
                          Vídeo da aula
                          <input
                            value={lesson.videoUrl ?? ''}
                            onChange={(event) => updateLesson(module.id, lesson.id, 'videoUrl', event.target.value)}
                            placeholder="Cole o link do YouTube da aula"
                          />
                        </label>
                        {getYouTubeVideo(lesson.videoUrl) ? (
                          <YouTubePreviewLink
                            url={lesson.videoUrl}
                            title={lesson.title || 'Aula do curso'}
                            caption={`${course.title} - ${module.title}`}
                            openMediaViewer={openMediaViewer}
                          />
                        ) : (
                          <small className="youtube-helper-text">
                            Suba o vídeo no YouTube como público/não listado e cole o link para liberar a prévia.
                          </small>
                        )}
                        <label>
                          Material de apoio
                          <input
                            value={lesson.attachmentUrl ?? ''}
                            onChange={(event) => updateLesson(module.id, lesson.id, 'attachmentUrl', event.target.value)}
                            placeholder="PDF, e-book, planilha ou link assinado"
                          />
                        </label>
                        <FileUpload
                          label="Arquivo de material"
                          action="Enviar material"
                          accept=".pdf,.epub,.doc,.docx,.xls,.xlsx,image/*"
                          onChange={(event) =>
                            updateLesson(
                              module.id,
                              lesson.id,
                              'attachmentUrl',
                              event.target.files?.[0]?.name
                                ? `Arquivo: ${event.target.files[0].name}`
                                : lesson.attachmentUrl,
                            )
                          }
                        />
                        <label>
                          Nome do material
                          <input
                            value={lesson.material}
                            onChange={(event) => updateLesson(module.id, lesson.id, 'material', event.target.value)}
                            placeholder="Material complementar"
                          />
                        </label>
                        <label>
                          Regra para avançar
                          <input
                            value={lesson.unlockRule}
                            onChange={(event) => updateLesson(module.id, lesson.id, 'unlockRule', event.target.value)}
                            placeholder="Ex: assistir 80%, enviar tarefa, concluir leitura"
                          />
                        </label>
                        <label className="lesson-assignment-field">
                          Tarefa ou instrução da aula
                          <textarea
                            value={lesson.assignment ?? ''}
                            onChange={(event) => updateLesson(module.id, lesson.id, 'assignment', event.target.value)}
                            placeholder="Descreva a atividade, critério de aprovação ou feedback esperado"
                          />
                        </label>
                      </div>

                      <small className="completion-hint">
                        Avanço da pessoa: {lesson.unlockRule || 'defina uma condição para liberar a próxima aula'}.
                      </small>
                    </section>
                  ))}
                </div>

                <button className="add-lesson-button" onClick={() => addLesson(module.id)}>
                  Adicionar aula neste módulo
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside className="course-publish-panel">
          <span className="section-kicker">Publicação</span>
          <h3>Checklist do produtor</h3>
          <ul>
            {checklist.map((item) => (
              <li className={item.done ? 'done' : ''} key={item.label}>{item.label}</li>
            ))}
          </ul>

          <div className="publication-issues">
            <strong>{readyToPublish ? 'Pronto para publicar' : 'Pendências encontradas'}</strong>
            {publicationIssues.length === 0 ? (
              <p>O curso tem informações comerciais, módulos, conteúdo das aulas e regras de avanço suficientes para publicação.</p>
            ) : (
              publicationIssues.map((issue) => (
                <button
                  className="issue-button"
                  key={issue.id}
                  onClick={() => scrollToPublicationTarget(issue.targetId)}
                  type="button"
                >
                  <span>{issue.label}</span>
                  <small>{issue.detail}</small>
                </button>
              ))
            )}
          </div>

          {publishNotice && <p className="publish-assistant-note">{publishNotice}</p>}
          <button onClick={handlePublishCourse}>
            {course.published ? 'Atualizar publicação' : 'Publicar curso'}
          </button>
          <p className="policy-note">
            Se faltar algo, o assistente leva você direto ao ponto pendente. Quando tudo estiver correto, o curso entra na vitrine e pode receber inscrições.
          </p>
        </aside>
      </div>

      {course.published && !course.isFree && (
        <section className="finance-panel">
          <span className="section-kicker">Financeiro</span>
          <h3>Vendas do curso</h3>
          <div className="finance-grid">
            <article>
              <strong>{course.students}</strong>
              <span>Pessoas compraram</span>
            </article>
            <article>
              <strong>{formatCurrency(course.revenue)}</strong>
              <span>Receita bruta</span>
            </article>
            <article>
              <strong>{formatCurrency(course.platformFeeRevenue)}</strong>
              <span>Taxa da plataforma ({course.platformFeePercent}%)</span>
            </article>
            <article>
              <strong>{formatCurrency(course.producerNetRevenue)}</strong>
              <span>Disponível ao produtor</span>
            </article>
            <article>
              <strong>Pix</strong>
              <span>Saque para sua conta</span>
            </article>
          </div>
          <label>
            Chave Pix para retirada
            <input placeholder="email, CPF/CNPJ ou chave aleatória" />
          </label>
          <button>Solicitar saque via Pix</button>
        </section>
      )}
    </section>
  );
}

// Checkout do curso: simula pagamento e split da taxa da plataforma.
function CheckoutView({ course, finishEnrollment, goBack, openPage }) {
  const [paymentMethod, setPaymentMethod] = useState(course?.isFree ? 'free' : 'pix');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [mockPaymentStatus, setMockPaymentStatus] = useState('paid');

  if (!course) {
    return (
      <section className="checkout-page zoom-in">
        <button className="back-button" type="button" onClick={() => goBack('courses')}>
          Voltar para cursos
        </button>
        <PageHeader
          label="Inscrição"
          title="Selecione um curso antes de pagar"
          description="O checkout precisa de um curso escolhido para calcular valor, split da plataforma e status de inscrição."
        />
        <section className="profile-card checkout-card">
          <span className="section-kicker">Checkout</span>
          <h3>Nenhum curso selecionado</h3>
          <p>
            Abra a vitrine de cursos, escolha uma oferta e clique em inscrever-se.
            Assim o pagamento fica vinculado ao curso correto.
          </p>
          <button type="button" onClick={() => openPage('courses')}>
            Ver cursos disponíveis
          </button>
        </section>
      </section>
    );
  }

  const split = calculatePlatformSplit(course.price);
  const paymentLabels = {
    card: 'Cartão',
    pix: 'Pix',
    boleto: 'Boleto',
    free: 'Gratuito',
  };

  function confirmPayment() {
    if (course.isFree) {
      setPaymentNotice('Inscrição gratuita confirmada.');
      finishEnrollment(course.id, 'free');
      return;
    }

    if (mockPaymentStatus !== 'paid') {
      setPaymentNotice('Pagamento não realizado. A central foi notificada para acompanhar.');
      finishEnrollment(course.id, mockPaymentStatus);
      return;
    } else {
      setPaymentNotice(`Pagamento por ${paymentLabels[paymentMethod]} confirmado no mock.`);
    }
    finishEnrollment(course.id, 'paid');
  }

  return (
    <section className="checkout-page zoom-in">
      <button className="back-button" type="button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Inscrição"
        title={`Inscrever-se em ${course.title}`}
        description="Após confirmar, a Pessoa Física é notificada por email e o produtor também recebe aviso de inscrição ou compra."
      />
      <div className="checkout-grid">
        <section className="profile-card checkout-card buyer-card">
          <span className="section-kicker">Dados do comprador</span>
          <h3>Identificação</h3>
          <label>Nome completo<input defaultValue="Lucas Carvalho" /></label>
          <label>Email<input defaultValue="lucas@meetpoint.com" /></label>
          <label>Celular<input defaultValue="+55 11 99999-0000" /></label>
          <label>CPF<input placeholder="000.000.000-00" /></label>
          <label>Endereço de cobrança<input placeholder="Rua, número, cidade e UF" /></label>
        </section>

        <section className="profile-card checkout-card payment-card">
          <span className="section-kicker">Pagamento</span>
          <h3>{course.isFree ? 'Curso gratuito' : `Total: ${formatCurrency(course.price)}`}</h3>
          {!course.isFree && (
            <div className="fee-preview compact">
              <strong>Split da venda</strong>
              <span>Taxa da plataforma: {formatCurrency(split.platformFee)} ({course.platformFeePercent}%)</span>
              <span>Repasse ao produtor: {formatCurrency(split.producerNet)}</span>
            </div>
          )}

          {!course.isFree && (
            <div className="payment-methods">
              {[
                ['pix', 'Pix', 'Aprovação rápida'],
                ['card', 'Cartão', 'Crédito em até 12x'],
                ['boleto', 'Boleto', 'Compensação bancária'],
              ].map(([method, label, description]) => (
                <button
                  className={paymentMethod === method ? 'active' : ''}
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  type="button"
                >
                  <strong>{label}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          )}

          {!course.isFree && (
            <div className="payment-status-switch">
              <button className={mockPaymentStatus === 'paid' ? 'active' : ''} type="button" onClick={() => setMockPaymentStatus('paid')}>Pago</button>
              <button className={mockPaymentStatus === 'pending' ? 'active' : ''} type="button" onClick={() => setMockPaymentStatus('pending')}>Pendente</button>
              <button className={mockPaymentStatus === 'failed' ? 'active' : ''} type="button" onClick={() => setMockPaymentStatus('failed')}>Falhou</button>
            </div>
          )}

          {course.isFree && (
            <div className="payment-state">
              <strong>Sem cobrança</strong>
              <p>Este curso entra direto no perfil da Pessoa Física após confirmar a inscrição.</p>
            </div>
          )}

          {!course.isFree && paymentMethod === 'card' && (
            <div className="payment-state">
              <strong>Cartão de crédito</strong>
              <label>Nome impresso no cartão<input placeholder="Lucas Carvalho" /></label>
              <label>Número do cartão<input placeholder="0000 0000 0000 0000" /></label>
              <div className="payment-inline">
                <label>Validade<input placeholder="MM/AA" /></label>
                <label>CVV<input placeholder="123" /></label>
                <label>Parcelas<select defaultValue="1"><option value="1">1x sem juros</option><option value="6">6x</option><option value="12">12x</option></select></label>
              </div>
            </div>
          )}

          {!course.isFree && paymentMethod === 'pix' && (
            <div className="payment-state pix-state">
              <strong>Pix copia e cola</strong>
              <div className="qr-box">PIX</div>
              <code>00020126580014br.gov.bcb.pix0136meetpoint-{course.id}-mock</code>
              <p>Em produção, o gateway retorna QR Code, copia e cola e confirma via webhook.</p>
            </div>
          )}

          {!course.isFree && paymentMethod === 'boleto' && (
            <div className="payment-state">
              <strong>Boleto bancário</strong>
              <label>CPF/CNPJ do pagador<input placeholder="000.000.000-00" /></label>
              <label>Vencimento<input type="date" defaultValue="2026-06-20" /></label>
              <p>O curso é liberado após compensação ou confirmação do gateway.</p>
            </div>
          )}

          {paymentNotice && <p className="valid-note">{paymentNotice}</p>}
          <button type="button" onClick={confirmPayment}>
            {course.isFree ? 'Confirmar inscrição gratuita' : `Pagar com ${paymentLabels[paymentMethod]}`}
          </button>
        </section>

        <aside className="checkout-summary">
          <span className="section-kicker">Resumo</span>
          <h3>{course.title}</h3>
          <p>Produtor: {course.instructor}</p>
          <p>Empresa: {course.company}</p>
          <div>
            <strong>{course.isFree ? 'Grátis' : formatCurrency(course.price)}</strong>
            <span>{course.isFree ? 'Sem taxa de pagamento' : `Método: ${paymentLabels[paymentMethod]}`}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

// Tela Comunidades: chat, moderação, mensagens e ferramentas de administrador.
// Comunidades: conversa em grupo, mensagens privadas, eventos e ferramentas de admin.
function CommunitiesView({
  activeCommunity,
  profilePhoto,
  currentUser,
  communityBubbleOpen,
  closeCommunityBubble,
  openPrivateChat,
  openCommunityCreate,
  showMemberSuggestion,
  dismissMemberSuggestion,
  addCommunityEvent,
  addCommunityMember,
  removeCommunityMember,
  updateCommunityName,
  updateCommunityPhoto,
  deleteEmptyCommunity,
}) {
  const [draft, setDraft] = useState('');
  const [moderationMessage, setModerationMessage] = useState('');
  const [localMessages, setLocalMessages] = useState(messages);
  const [unreadCommunityMessages, setUnreadCommunityMessages] = useState(0);
  const [communityToast, setCommunityToast] = useState('');
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const communityMessagesRef = React.useRef(null);
  const [editingCommunityMessageId, setEditingCommunityMessageId] = useState('');
  const [communityEditDraft, setCommunityEditDraft] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [communityNotificationsOpen, setCommunityNotificationsOpen] = useState(false);
  const [eventActionModalOpen, setEventActionModalOpen] = useState(false);
  const [communityDetailsOpen, setCommunityDetailsOpen] = useState(false);
  const communityDetailsModalRef = React.useRef(null);
  const [communityNameDraft, setCommunityNameDraft] = useState(activeCommunity?.name ?? '');
  const [memberDraft, setMemberDraft] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [communityMembers, setCommunityMembers] = useState([]);
  const [eventDraft, setEventDraft] = useState({
    title: 'Networking da comunidade',
    type: 'Videochamada',
    date: '2026-06-20',
    time: '19:00',
    required: false,
  });

  useEffect(() => {
    setCommunityNameDraft(activeCommunity?.name ?? '');
  }, [activeCommunity?.name]);

  useEffect(() => {
    setCommunityDetailsOpen(false);
  }, [activeCommunity?.id]);

  useEffect(() => {
    if (!communityDetailsOpen) return undefined;

    function closeDetailsWithEscape(event) {
      if (event.key !== 'Escape') return;
      setCommunityDetailsOpen(false);
    }

    window.requestAnimationFrame(() => {
      communityDetailsModalRef.current?.focus?.();
      communityDetailsModalRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    });

    document.addEventListener('keydown', closeDetailsWithEscape);
    return () => document.removeEventListener('keydown', closeDetailsWithEscape);
  }, [communityDetailsOpen]);

  useEffect(() => {
    if (!activeCommunity) {
      setCommunityMembers([]);
      return;
    }

    const currentMemberName = currentUser?.name ?? 'Lucas Carvalho';
    const mockMembers = [
      { id: 'rafael', name: 'Rafael Nunes', role: 'Membro', initials: 'RN' },
      { id: 'marina', name: 'Marina Costa', role: 'Membro', initials: 'MC' },
      { id: 'ana', name: 'Ana Lima', role: 'Admin', initials: 'AL' },
    ].filter(
      (member) => member.name.toLowerCase() !== currentMemberName.toLowerCase(),
    );

    setCommunityMembers([
      {
        id: 'current-user',
        name: currentMemberName,
        role: activeCommunity.isAdmin ? 'Admin' : 'Membro',
        initials: getInitials(currentMemberName),
      },
      ...mockMembers,
    ]);
  }, [activeCommunity?.id, currentUser?.initials, currentUser?.name]);

   function scrollCommunityToBottom() {
    const list = communityMessagesRef.current;
    if (!list) return;

    list.scrollTo({
      top: list.scrollHeight,
      behavior: 'smooth',
    });
  }

  function isCommunityNearBottom() {
    const list = communityMessagesRef.current;
    if (!list) return true;

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;

    return distanceFromBottom < 120;
  }

  function publish() {
    const shouldAutoScroll = isCommunityNearBottom();

    const blocked = bannedTerms.some((term) =>
      draft.toLowerCase().includes(term),
    );

    if (blocked) {
      setModerationMessage('Publicação bloqueada por política de conteúdo sensível.');
      return;
    }

    if (!draft.trim()) return;

    setLocalMessages((current) => [
      ...current,
      {
        id: `community-message-${Date.now()}`,
        author: currentUser?.name ?? 'Visitante',
        role: currentUser?.label ?? 'Membro',
        time: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAt: Date.now(),
        body: draft,
        mine: true,
        edited: false,
        deleted: false,
        deletedByAdmin: false,
      },
    ]);

    setDraft('');
    setModerationMessage('Mensagem enviada para a comunidade.');
    setCommunityToast('Nova mensagem na comunidade.');

    if (shouldAutoScroll) {
      setTimeout(scrollCommunityToBottom, 80);
      setUnreadCommunityMessages(0);
      setShowNewMessageButton(false);
    } else {
      setUnreadCommunityMessages((current) => current + 1);
      setShowNewMessageButton(true);
    }

    setTimeout(() => setCommunityToast(''), 3500);
  }

  function handleMessageKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      publish();
    }
  }
  function canAuthorModifyMessage(message) {
    const twoMinutes = 1000 * 60 * 2;
    return message.mine && Date.now() - message.createdAt <= twoMinutes;
  }

  function canAdminDeleteMessage() {
    return Boolean(activeCommunity?.isAdmin);
  }

  function editCommunityMessage(messageId, nextBody) {
    if (!nextBody.trim()) return;

    setLocalMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;

        if (!canAuthorModifyMessage(message)) return message;

        return {
          ...message,
          body: nextBody.trim(),
          edited: true,
          editedAt: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      }),
    );

    setEditingCommunityMessageId('');
    setCommunityEditDraft('');
    setModerationMessage('Mensagem editada.');
  }

  function deleteCommunityMessage(messageId) {
    setLocalMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;

        const deletedByAdmin = canAdminDeleteMessage() && !canAuthorModifyMessage(message);

        if (!canAuthorModifyMessage(message) && !canAdminDeleteMessage()) {
          return message;
        }

        return {
          ...message,
          body: '',
          deleted: true,
          deletedByAdmin,
          deletedAt: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      }),
    );

    setModerationMessage('Mensagem apagada.');
  }

  function runAdminAction(action) {
    if (!activeCommunity?.isAdmin) {
      setAdminStatus('Você não é admin. Solicite ao administrador.');
      return;
    }
    setAdminStatus(action);
  }

  function requestEvent() {
    addCommunityEvent({
      ...eventDraft,
      title: eventDraft.title || 'Evento da comunidade',
      owner: activeCommunity?.name ?? 'Comunidade',
      source: 'community',
    });
  }

  function renameCommunity() {
    if (!activeCommunity?.id) return;
    if (!activeCommunity.isAdmin) {
      setAdminStatus('Somente admin pode alterar o nome da comunidade.');
      return;
    }

    updateCommunityName(activeCommunity.id, communityNameDraft);
    setAdminStatus('Nome da comunidade atualizado.');
  }

  function handleCommunityPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file || !activeCommunity?.id) return;
    if (!activeCommunity.isAdmin) {
      setAdminStatus('Somente admin pode alterar a foto da comunidade.');
      return;
    }

    updateCommunityPhoto(activeCommunity.id, URL.createObjectURL(file));
    setAdminStatus('Foto da comunidade atualizada.');
  }

  function addMemberToCommunity() {
    const name = memberDraft.trim();
    if (!activeCommunity?.id || !name) return;
    if (!activeCommunity.isAdmin) {
      setAdminStatus('Sugestão enviada para o administrador da comunidade.');
      return;
    }

    setCommunityMembers((current) => [
      {
        id: `member-${Date.now()}`,
        name,
        role: 'Membro',
        initials: getInitials(name),
      },
      ...current,
    ]);
    addCommunityMember(activeCommunity.id);
    setMemberDraft('');
    setAdminStatus(`${name} foi adicionado como membro.`);
  }

  function removeMemberFromCommunity(memberId) {
    if (!activeCommunity?.id || !activeCommunity.isAdmin) {
      setAdminStatus('Somente admin pode remover membros.');
      return;
    }

    const member = communityMembers.find((item) => item.id === memberId);
    if (!member || member.role === 'Admin') {
      setAdminStatus('Remova o cargo de admin antes de excluir este membro.');
      return;
    }

    setCommunityMembers((current) => current.filter((item) => item.id !== memberId));
    removeCommunityMember(activeCommunity.id);
    setAdminStatus(`${member.name} foi removido da comunidade.`);
  }

  function banMemberFromCommunity(memberId) {
    if (!activeCommunity?.id || !activeCommunity.isAdmin) {
      setAdminStatus('Somente admin pode banir membros.');
      return;
    }

    const member = communityMembers.find((item) => item.id === memberId);
    if (!member || member.role === 'Admin') {
      setAdminStatus('Remova o cargo de admin antes de banir este membro.');
      return;
    }

    setCommunityMembers((current) => current.filter((item) => item.id !== memberId));
    removeCommunityMember(activeCommunity.id);
    setAdminStatus(`${member.name} foi banido da comunidade.`);
  }

  function promoteMemberToAdmin(memberId) {
    if (!activeCommunity?.isAdmin) {
      setAdminStatus('Somente admin pode promover membros.');
      return;
    }

    setCommunityMembers((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, role: 'Admin' } : member,
      ),
    );
    setAdminStatus('Permissão de admin atualizada.');
  }

  function handleDeleteCommunity() {
    if (!activeCommunity?.id) return;
    const confirmed = window.confirm('Excluir esta comunidade vazia? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    setAdminStatus(deleteEmptyCommunity(activeCommunity.id));
  }

  const communityNotificationCount = unreadCommunityMessages + (communityToast ? 1 : 0);
  const filteredCommunityMembers = communityMembers.filter((member) => {
    const search = memberSearch.trim().toLowerCase();
    return !search || member.name.toLowerCase().includes(search);
  });
  const communityAdminCount = communityMembers.filter((member) => member.role === 'Admin').length;

  function renderCommunityDetailsBody() {
    if (!activeCommunity) return null;

    return (
      <>
        <header className="community-details-header">
          <div className="community-details-identity">
            <CommunityAvatar community={activeCommunity} className="community-details-avatar" />
            <div>
              <span className="section-kicker">{activeCommunity.type}</span>
              <h3>{activeCommunity.name}</h3>
              <p>{activeCommunity.topic}</p>
              {activeCommunity.isAdmin && (
                <label className="community-photo-upload compact">
                  <input type="file" accept="image/*" onChange={handleCommunityPhotoChange} />
                  <span>{activeCommunity.photo ? 'Trocar foto' : 'Adicionar foto'}</span>
                </label>
              )}
            </div>
          </div>
          <button className="light" type="button" onClick={() => setCommunityDetailsOpen(false)}>
            Fechar detalhes
          </button>
        </header>

        <div className="community-detail-stats">
          <span>{activeCommunity.members ?? 0} membros</span>
          <span>{communityAdminCount} admin(s)</span>
          <span>{activeCommunity.relatedTo}</span>
        </div>

        <section className="community-name-editor">
          <label>
            Nome da comunidade
            <input
              value={communityNameDraft}
              onChange={(event) => setCommunityNameDraft(event.target.value)}
            />
          </label>
          <button type="button" onClick={renameCommunity}>
            Salvar nome
          </button>
        </section>

        <section className="community-member-manager">
          <div className="community-member-summary">
            <div>
              <span className="section-kicker">Membros</span>
              <strong>Quem está na comunidade</strong>
            </div>
            <input
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Buscar membro"
            />
          </div>
          <div className="community-member-strip">
            {filteredCommunityMembers.map((member) => (
              <article key={member.id}>
                <span>{member.initials}</span>
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </div>
                {activeCommunity.isAdmin && member.role !== 'Admin' && (
                  <div className="community-member-actions">
                    <button type="button" onClick={() => promoteMemberToAdmin(member.id)}>
                      Admin
                    </button>
                    <button className="danger-action" type="button" onClick={() => removeMemberFromCommunity(member.id)}>
                      Remover
                    </button>
                    <button className="danger-action" type="button" onClick={() => banMemberFromCommunity(member.id)}>
                      Banir
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="community-admin-tools">
          <label className="member-add-field">
            {activeCommunity?.isAdmin ? 'Adicionar membro' : 'Sugerir membro'}
            <input
              value={memberDraft}
              onChange={(event) => setMemberDraft(event.target.value)}
              placeholder="Email, celular ou nome"
            />
          </label>
          <button type="button" onClick={addMemberToCommunity}>
            {activeCommunity?.isAdmin ? 'Adicionar à comunidade' : 'Sugerir ao admin'}
          </button>
          <button
            className="danger-action light"
            disabled={!activeCommunity?.isAdmin || (activeCommunity?.members ?? 0) > 0}
            type="button"
            onClick={handleDeleteCommunity}
          >
            Excluir comunidade vazia
          </button>
          {adminStatus && <p className="policy-note">{adminStatus}</p>}
        </section>

        <details className="event-request-box">
          <summary>Evento e votação</summary>
          <label>
            Nome do encontro
            <input
              value={eventDraft.title}
              onChange={(event) =>
                setEventDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Tipo
            <select
              value={eventDraft.type}
              onChange={(event) =>
                setEventDraft((current) => ({ ...current, type: event.target.value }))
              }
            >
              <option>Videochamada</option>
              <option>Ligação</option>
              <option>Conversa aberta</option>
              <option>Networking</option>
            </select>
          </label>
          <div className="event-date-grid">
            <label>
              Dia
              <input
                type="date"
                value={eventDraft.date}
                onChange={(event) =>
                  setEventDraft((current) => ({ ...current, date: event.target.value }))
                }
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                value={eventDraft.time}
                onChange={(event) =>
                  setEventDraft((current) => ({ ...current, time: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={eventDraft.required}
              onChange={(event) =>
                setEventDraft((current) => ({
                  ...current,
                  required: event.target.checked,
                }))
              }
            />
            Obrigatório para o curso
          </label>
          <button type="button" onClick={requestEvent}>Criar votação de evento</button>
        </details>
      </>
    );
  }

  return (
    <div className="community-layout community-chat-workspace">
      <section className="community-main-area">
        {!activeCommunity && (
          <section className="empty-state page-empty-state">
            <span className="section-kicker">Comunidades</span>
            <h3>Nenhuma comunidade disponível</h3>
            <p>Quando a primeira comunidade for criada, o chat, membros e eventos aparecerão aqui.</p>
            <button type="button" onClick={openCommunityCreate}>Criar primeira comunidade</button>
          </section>
        )}

        {showMemberSuggestion && (
          <aside className="member-suggestion">
            <div>
              <span className="section-kicker">Antes de começar</span>
              <h3>Adicionar pessoas a comunidade?</h3>
              <p>
                Convide amigos, alunos ou colaboradores agora para já iniciar o
                grupo com participantes.
              </p>
            </div>
            <div className="invite-row">
              <input placeholder="Email, celular ou nome completo" />
              <button>Enviar convite</button>
              <button className="light" onClick={dismissMemberSuggestion}>
                Depois
              </button>
            </div>
          </aside>
        )}

        {communityToast && (
          <div className="community-toast">
            🔔 {communityToast}
          </div>
          )}

        {communityBubbleOpen && activeCommunity && (
          <section className="community-chat-inline">
            <div className="community-whatsapp-shell">
              <section className="community-chat-panel">
                <header className="community-chat-titlebar">
                  <button
                    className="community-title-trigger"
                    type="button"
                    onClick={() => setCommunityDetailsOpen(true)}
                  >
                    <CommunityAvatar community={activeCommunity} className="community-title-avatar" />
                    <div>
                      <strong>{activeCommunity.name}</strong>
                      <small>
                        {activeCommunity.members ?? 0} membros - {getCommunityAccessLabel(activeCommunity)} - clique para ver membros e edições
                      </small>
                    </div>
                  </button>
                  <div className="community-title-actions">
                    <button
                      className="round-icon-button"
                      type="button"
                      aria-label="Detalhes da comunidade"
                      onClick={() => setCommunityDetailsOpen(true)}
                    >
                      i
                    </button>
                    <button className="light" type="button" onClick={closeCommunityBubble}>
                      Fechar
                    </button>
                  </div>
                </header>
	        <div className="message-list" ref={communityMessagesRef}>
	          {localMessages.map((message, index) => (
            <article
              className={message.mine ? 'message mine' : 'message'}
              key={`${message.author}-${message.time}-${index}`}
            >
              <header>
	                <Avatar
	                  initials={message.mine ? getInitials(currentUser?.name ?? 'Visitante') : getInitials(message.author)}
	                  photo={message.mine ? profilePhoto : ''}
	                />
                <strong>{message.mine ? currentUser?.name ?? 'Visitante' : message.author}</strong>
                <span>{message.role}</span>
                <time>{message.time}</time>
              </header>
            <>
  {message.deleted ? (
    <p className="deleted-message">
      {message.deletedByAdmin
        ? `🛡️ O administrador removeu esta mensagem às ${message.deletedAt}`
        : `🗑️ Esta mensagem foi apagada pelo autor às ${message.deletedAt}`}
    </p>
  ) : (
    <>
      {editingCommunityMessageId === message.id ? (
        <div className="comment-edit-panel">
          <textarea
            className="platform-textarea"
            value={communityEditDraft}
            onChange={(event) => setCommunityEditDraft(event.target.value)}
          />

          <div className="micro-actions edit-save-actions">
            <button
              className="social-action-button save-action"
              onClick={() =>
                editCommunityMessage(message.id, communityEditDraft)
              }
            >
              💾 Salvar alterações
            </button>

            <button
              className="social-action-button cancel-action"
              onClick={() => {
                setEditingCommunityMessageId('');
                setCommunityEditDraft('');
              }}
            >
              ↩ Cancelar edição
            </button>
          </div>
        </div>
      ) : (
        <>
          <p>{message.body}</p>

          {message.edited && (
            <small className="edited-label">
              editado às {message.editedAt}
            </small>
          )}

          {(canAuthorModifyMessage(message) ||
            canAdminDeleteMessage()) && (
            <div className="micro-actions">
              {canAuthorModifyMessage(message) && (
                <button
                  className="social-action-button edit-action"
                  onClick={() => {
                    setEditingCommunityMessageId(message.id);
                    setCommunityEditDraft(message.body);
                  }}
                >
                  ✏️ Editar
                </button>
              )}

              <button
                className="social-action-button danger-action"
                onClick={() => {
                  const confirmed = window.confirm(
                    'Deseja apagar esta mensagem?',
                  );

                  if (!confirmed) return;

                  deleteCommunityMessage(message.id);
                }}
              >
                🗑️ Apagar
              </button>
            </div>
          )}
        </>
      )}
    </>
  )}
</>
            </article>
          ))}
        </div>
        {showNewMessageButton && (
  <button
    className="new-message-floating"
    onClick={() => {
      scrollCommunityToBottom();
      setUnreadCommunityMessages(0);
      setShowNewMessageButton(false);
    }}
  >
    ↓ Nova mensagem ({unreadCommunityMessages})
  </button>
)}

        <div className="chat-composer">
	          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleMessageKeyDown}
            placeholder="Escreva uma mensagem para a comunidade..."
          />
          <div>
            <button>Arquivo</button>
            <button
              className="composer-plus-button"
              type="button"
              onClick={() => setEventActionModalOpen(true)}
            >
              +
            </button>
            <button>Foto/vídeo</button>
            <button className="primary" onClick={publish}>Enviar</button>
          </div>
	          {moderationMessage && <p className="policy-note">{moderationMessage}</p>}
	        </div>
              </section>

            </div>
          </section>
        )}
      </section>
      {communityDetailsOpen && activeCommunity && (
        <div
          className="floating-backdrop community-details-backdrop"
          onClick={() => setCommunityDetailsOpen(false)}
        >
          <section
            className="floating-modal community-details-panel community-details-modal"
            onClick={(event) => event.stopPropagation()}
            ref={communityDetailsModalRef}
            tabIndex={-1}
          >
            {renderCommunityDetailsBody()}
          </section>
        </div>
      )}
      {eventActionModalOpen && (
        <div className="floating-backdrop" onClick={() => setEventActionModalOpen(false)}>
          <section className="floating-modal compact-event-actions-modal" onClick={(event) => event.stopPropagation()}>
            <span className="section-kicker">Ações de evento</span>
            <h3>Criar ou enviar chamada</h3>
            <div className="event-action-choice-grid">
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Evento público preparado.'); }}>
                Criar evento público
              </button>
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Evento privado preparado.'); }}>
                Criar evento privado
              </button>
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Evento presencial preparado.'); }}>
                Evento presencial
              </button>
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Evento online preparado.'); }}>
                Evento online
              </button>
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Chamada enviada para a comunidade.'); }}>
                Enviar para comunidade
              </button>
              <button type="button" onClick={() => { requestEvent(); setEventActionModalOpen(false); }}>
                Solicitar votação
              </button>
              <button type="button" onClick={() => { setEventActionModalOpen(false); runAdminAction('Inscrições abertas para o evento.'); }}>
                Abrir inscrições
              </button>
            </div>
            <button className="light" type="button" onClick={() => setEventActionModalOpen(false)}>
              Fechar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

// Criacao de comunidade: formulario com nicho, assunto e vinculo opcional.
function CreateCommunityView({ createCommunity, goBack, niches, addNiche }) {
  const defaultRelatedOptions = [
    'Curso: Arquitetura SaaS Multi-Tenant',
    'Curso: Comunidades, Conteúdo e Retenção',
    'Curso: Entrega de Conteúdo em Escala',
    'Nicho: Networking profissional',
    'Nicho: Mentorias e eventos',
  ];
  const [form, setForm] = useState({
    name: '',
    topic: '',
    type: 'Educação',
    relatedTo: 'Curso: Arquitetura SaaS Multi-Tenant',
    accessMode: 'public',
    password: '',
    color: 'yellow',
    photo: '',
  });
  const [customNiche, setCustomNiche] = useState('');
  const [relatedOptions, setRelatedOptions] = useState(defaultRelatedOptions);
  const [customRelatedTo, setCustomRelatedTo] = useState('');
  const [accessError, setAccessError] = useState('');

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleCommunityCreatePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    updateForm('photo', URL.createObjectURL(file));
  }

  function submit(event) {
    event.preventDefault();
    if (form.accessMode === 'password' && !form.password.trim()) {
      setAccessError('Defina uma senha para criar comunidade privada com senha.');
      return;
    }
    setAccessError('');
    const relatedTo =
      form.relatedTo === 'Outro curso ou tema'
        ? `Tema: ${customRelatedTo.trim() || 'Tema próprio'}`
        : form.relatedTo;
    createCommunity({
      ...form,
      relatedTo,
      name: form.name || 'Nova comunidade',
      topic: form.topic || 'Assunto ainda não definido',
      password: form.accessMode === 'password' ? form.password.trim() : '',
    });
  }

  function addCustomRelatedTo() {
    const value = customRelatedTo.trim();
    if (!value) return;
    const label =
      /^(curso|tema|nicho):/i.test(value)
        ? value
        : `Tema: ${value}`;
    setRelatedOptions((current) => (current.includes(label) ? current : [...current, label]));
    updateForm('relatedTo', label);
    setCustomRelatedTo('');
  }

  return (
    <section className="create-community-page">
      <button className="back-button" onClick={goBack}>Voltar</button>
      <PageHeader
        label="Nova comunidade"
        title="Criar comunidade"
        description="Defina nome, assunto, nicho e se a comunidade será ligada a um curso específico."
      />

      <form className="create-community-form" onSubmit={submit}>
        <section className="builder-card">
          <span className="section-kicker">Identidade</span>
          <div className="community-photo-field">
            <CommunityAvatar
              community={{ name: form.name || 'Nova comunidade', photo: form.photo }}
              className="community-create-avatar"
            />
            <label className="community-photo-upload">
              <input type="file" accept="image/*" onChange={handleCommunityCreatePhoto} />
              <span>{form.photo ? 'Trocar foto da comunidade' : 'Adicionar foto da comunidade'}</span>
            </label>
          </div>
          <label>
            Nome da comunidade
            <input
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="Ex: Alunos de Produto Digital"
            />
          </label>
          <label>
            Assunto principal
            <input
              value={form.topic}
              onChange={(event) => updateForm('topic', event.target.value)}
              placeholder="Ex: Retenção, networking e estudos"
            />
          </label>
          <label>
            Nicho
            <select
              value={form.type}
              onChange={(event) => updateForm('type', event.target.value)}
            >
              {niches.filter((niche) => niche !== 'Todas').map((niche) => (
                <option key={niche}>{niche}</option>
              ))}
            </select>
          </label>
          <div className="add-niche-row">
            <input
              value={customNiche}
              onChange={(event) => setCustomNiche(event.target.value)}
              placeholder="Nicho próprio"
            />
            <button
              type="button"
              onClick={() => {
                addNiche(customNiche);
                updateForm('type', customNiche.trim() || form.type);
                setCustomNiche('');
              }}
            >
              Adicionar
            </button>
          </div>
        </section>

        <section className="builder-card">
          <span className="section-kicker">Referente a</span>
          <label>
            Vincular a curso ou tema
            <select
              value={form.relatedTo}
              onChange={(event) => updateForm('relatedTo', event.target.value)}
            >
              {relatedOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
              <option>Outro curso ou tema</option>
            </select>
          </label>
          {form.relatedTo === 'Outro curso ou tema' && (
            <div className="add-niche-row">
              <input
                value={customRelatedTo}
                onChange={(event) => setCustomRelatedTo(event.target.value)}
                placeholder="Digite curso ou tema"
              />
              <button type="button" onClick={addCustomRelatedTo}>
                Adicionar
              </button>
            </div>
          )}
          <label>
            Cor visual
            <select
              value={form.color}
              onChange={(event) => updateForm('color', event.target.value)}
            >
              <option value="yellow">Amarelo</option>
              <option value="pink">Creme</option>
              <option value="blue">Preto</option>
            </select>
          </label>
          <p className="policy-note">
            Ao criar, a comunidade aparece imediatamente na janela lateral e você
            entra como administrador.
          </p>
        </section>

        <section className="builder-card community-access-card">
          <span className="section-kicker">Acesso</span>
          <label>
            Tipo de entrada
            <select
              value={form.accessMode}
              onChange={(event) => updateForm('accessMode', event.target.value)}
            >
              <option value="public">Pública</option>
              <option value="invite">Privada por convite</option>
              <option value="password">Privada com senha</option>
            </select>
          </label>
          {form.accessMode === 'password' && (
            <label>
              Senha da comunidade
              <input
                type="password"
                data-protected-password="true"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => updateForm('password', event.target.value)}
                placeholder="Defina uma senha de entrada"
              />
            </label>
          )}
          <p className="policy-note">
            Comunidades privadas não entram livremente: por convite, só o admin libera;
            com senha, a pessoa precisa informar a senha definida.
          </p>
          {accessError && <p className="invalid-note">{accessError}</p>}
        </section>

        <aside className={`admin-card ${form.color}`}>
          <span className="section-kicker">Preview</span>
          <CommunityAvatar
            community={{ name: form.name || 'Nome da comunidade', photo: form.photo }}
            className="community-preview-avatar"
          />
          <h2>{form.name || 'Nome da comunidade'}</h2>
          <p>{form.topic || 'Assunto da comunidade'}</p>
          <p>{form.relatedTo === 'Outro curso ou tema' ? customRelatedTo || 'Tema próprio' : form.relatedTo}</p>
          <p>{form.accessMode === 'public' ? 'Pública' : form.accessMode === 'invite' ? 'Privada por convite' : 'Privada com senha'}</p>
          <button className="create-submit-button" type="submit">
            Criar comunidade
          </button>
        </aside>
      </form>
    </section>
  );
}


// Criacao de evento/chamada: publica networking, live ou encontro com inscricao.
function CreateEventCallView({ createEventCall, currentUser, goBack }) {
  // Tela dedicada para criar chamada de evento a partir do feed.
  // Altera somente eventos mockados enquanto a API real ainda não está conectada.
  const [form, setForm] = useState({
    title: '',
    objective: '',
    agenda: '',
    resources: '',
    audience: '',
    date: '',
    time: '',
    type: 'Networking',
    mode: 'Online',
    privacy: 'Público',
    location: '',
    capacity: '60',
    price: '0',
    requireDocument: false,
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'email') {
      setEmailVerificationSent(false);
      setSignupNotice('');
    }
  }

  function submit(event) {
    event.preventDefault();
    createEventCall({
      ...form,
      title: form.title || 'Chamada de evento',
      description: `${form.objective} ${form.agenda} ${form.resources} ${form.audience}`.trim(),
      capacity: Number(form.capacity || 60),
      price: Number(form.price || 0),
    });
  }

  return (
    <section>
      <button className="back-button" type="button" onClick={goBack}>
        Voltar
      </button>
      <PageHeader
        label="Chamada de evento"
        title="Criar evento para inscrição dos participantes"
        description="Pessoa Física, Pessoa Jurídica e empresa podem publicar eventos online ou presenciais, abrir inscrição e acompanhar participantes."
      />
      <form className="event-create-form" onSubmit={submit}>
        <section className="event-create-owner-card">
          <span className="section-kicker">Publicador</span>
          <strong>{currentUser?.name ?? 'Conta responsável'}</strong>
          <small>{currentUser?.label ?? 'Pessoa Física, Pessoa Jurídica ou Empresa'}</small>
        </section>
        <label>
          Título da chamada
          <input
            className="platform-input"
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
          />
        </label>
        <label>
          Objetivo da chamada
          <textarea
            className="platform-textarea"
            value={form.objective}
            onChange={(event) => update('objective', event.target.value)}
          />
        </label>

        <label>
          O que vai rolar
          <textarea
            className="platform-textarea"
            value={form.agenda}
            onChange={(event) => update('agenda', event.target.value)}
          />
        </label>

        <label>
          O que vai ter
          <textarea
            className="platform-textarea"
            value={form.resources}
            onChange={(event) => update('resources', event.target.value)}
          />
        </label>
        <label>
          Público indicado
          <input
            className="platform-input"
            value={form.audience}
            onChange={(event) => update('audience', event.target.value)}
          />
        </label>
        <div className="event-date-grid">
          <label>
            Tipo
            <select
              className="platform-input"
              value={form.type}
              onChange={(event) => update('type', event.target.value)}
            >
              <option>Networking</option>
              <option>Mentoria</option>
              <option>Aula ao vivo</option>
              <option>Palestra</option>
              <option>Workshop</option>
            </select>
          </label>

          <label>
            Formato
            <select
              className="platform-input"
              value={form.mode}
              onChange={(event) => update('mode', event.target.value)}
            >
              <option>Online</option>
              <option>Presencial</option>
            </select>
          </label>

          <label>
            Visibilidade
            <select
              className="platform-input"
              value={form.privacy}
              onChange={(event) => update('privacy', event.target.value)}
            >
              <option>Público</option>
              <option>Privado</option>
            </select>
          </label>

          <label>
            Data
            <input
              className="platform-input"
              type="date"
              value={form.date}
              onChange={(event) => update('date', event.target.value)}
            />
          </label>

          <label>
            Horário
            <input
              className="platform-input"
              type="time"
              value={form.time}
              onChange={(event) => update('time', event.target.value)}
            />
          </label>
        </div>
        <div className="event-date-grid">
          <label>
            Local ou link
            <input
              className="platform-input"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              placeholder={form.mode === 'Presencial' ? 'Endereço do evento' : 'Link ou sala online'}
            />
          </label>
          <label>
            Vagas
            <input
              className="platform-input"
              min="1"
              type="number"
              value={form.capacity}
              onChange={(event) => update('capacity', event.target.value)}
            />
          </label>
          <label>
            Valor
            <input
              className="platform-input"
              min="0"
              step="1"
              type="number"
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
            />
          </label>
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            checked={form.requireDocument}
            onChange={(event) => update('requireDocument', event.target.checked)}
          />
          Exigir documento na inscrição
        </label>
        <p className="policy-note">
          Toda inscrição exige login, nome, email real e WhatsApp. Documento fica protegido e aparece ao criador apenas como enviado.
        </p>
        <div className="button-row">
          <button type="submit">Publicar chamada</button>
          <button className="light" type="button" onClick={goBack}>Voltar</button>
        </div>
      </form>
    </section>
  );
}

// Eventos: separa confirmados, recusados e pendentes, com inscricao e calendario.
function EventsView({
  canCreateEvents,
  communityEvents,
  currentUser,
  eventCreatorAlerts,
  eventRegistrations,
  openPage,
  registerEventAttendance,
  requestAuthentication,
}) {
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('Próximos');
  const [eventDate, setEventDate] = useState('');
  const [votes, setVotes] = useState({});
  const [registrationEvent, setRegistrationEvent] = useState(null);
  const [eventPaymentMethod, setEventPaymentMethod] = useState('pix');
  const [eventPaymentNotice, setEventPaymentNotice] = useState('');
  const [eventRegistrationDraft, setEventRegistrationDraft] = useState({
    fullName: currentUser?.name ?? '',
    email: getContactEmail(currentUser),
    whatsapp: '',
    documentNumber: '',
    company: '',
  });

  const allEvents = [
    ...communityEvents,
    ...scheduledEvents.map((event) => ({
      ...event,
      id: event.title,
      source: event.type === 'Aula ao vivo' ? 'course' : 'community',
      required: event.type === 'Aula ao vivo',
      registrationRequired: true,
      requiredFields: ['name', 'email', 'whatsapp'],
    })),
  ];

  const today = new Date().toISOString().slice(0, 10);
  const eventIdFor = (event) => event.id ?? event.title;
  const registrationsFor = (event) => eventRegistrations[eventIdFor(event)] ?? [];
  const participantCountFor = (event) =>
    (event.participants?.length ?? 0) + (event.yes ?? 0) + registrationsFor(event).length;
  const isCreatedByCurrentUser = (event) =>
    Boolean(currentUser) &&
    (event.creatorEmail === currentUser.email || event.creatorName === currentUser.name || event.owner === currentUser.name);
  const createdByMeEvents = allEvents.filter(isCreatedByCurrentUser);
  const creatorAlertsForMe = (eventCreatorAlerts ?? []).filter(
    (alert) =>
      currentUser &&
      (alert.creatorEmail === currentUser.email || alert.creatorName === currentUser.name),
  );
  const filteredEvents = allEvents
    .filter((event) => {
      const search = eventSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.type.toLowerCase().includes(search) ||
        `${event.owner ?? ''}`.toLowerCase().includes(search);
      const matchesDate = !eventDate || event.date === eventDate;
      const matchesFilter =
        eventFilter === 'Todos' ||
        (eventFilter === 'Próximos' && event.date >= today) ||
        (eventFilter === 'Obrigatórios' && event.required) ||
        (eventFilter === 'Comunidade' && event.source === 'community') ||
        (eventFilter === 'Online' && event.mode === 'Online') ||
        (eventFilter === 'Presenciais' && event.mode === 'Presencial') ||
        (eventFilter === 'Aulas ao vivo' && event.type === 'Aula ao vivo');
      return matchesSearch && matchesDate && matchesFilter;
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const visibleEvents = filteredEvents.filter((event) => !votes[eventIdFor(event)]);
  const confirmedEvents = allEvents
    .filter((event) => votes[eventIdFor(event)] === 'yes')
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const declinedEvents = allEvents
    .filter((event) => votes[eventIdFor(event)] === 'no')
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  function vote(eventId, answer) {
    if (!currentUser) {
      requestAuthentication(answer === 'yes' ? 'inscrever-se em evento' : 'responder evento');
      return;
    }
    setVotes((current) => ({
      ...current,
      [eventId]: answer,
    }));
    setTimeout(() => {
      document.querySelector('[data-event-response-board]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 90);
  }

  function clearVote(eventId) {
    setVotes((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    setTimeout(() => {
      document.querySelector('[data-event-list]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 90);
  }

  function startEventRegistration(event) {
    if (!currentUser) {
      requestAuthentication('inscrever-se em evento');
      return;
    }
    setRegistrationEvent(event);
    setEventPaymentNotice('');
    setEventRegistrationDraft({
      fullName: currentUser.name ?? '',
      email: getContactEmail(currentUser),
      whatsapp: '',
      documentNumber: '',
      company: currentUser.segment === 'company' ? currentUser.name : '',
    });
  }

  function updateRegistrationDraft(field, value) {
    setEventRegistrationDraft((current) => ({ ...current, [field]: value }));
  }

  function confirmEventRegistration() {
    if (!registrationEvent) return;
    const result = registerEventAttendance(registrationEvent, eventRegistrationDraft);
    if (!result.ok) {
      setEventPaymentNotice(result.message);
      return;
    }
    setEventPaymentNotice(
      Number(registrationEvent.price ?? 0) > 0
        ? `Pagamento por ${eventPaymentMethod.toUpperCase()} aprovado. Inscrição confirmada.`
        : 'Inscrição gratuita confirmada.',
    );
    vote(eventIdFor(registrationEvent), 'yes');
    setTimeout(() => setRegistrationEvent(null), 700);
  }

  return (
    <section>
      {canCreateEvents && (
        <div className="page-action-row">
          <button type="button" onClick={() => openPage('event-create')}>
            Criar evento
          </button>
        </div>
      )}
      <div className="event-toolbar">
        <input
          value={eventSearch}
          onChange={(event) => setEventSearch(event.target.value)}
          placeholder="Pesquisar evento, produtor ou comunidade"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(event) => setEventDate(event.target.value)}
        />
        <div>
          {['Próximos', 'Todos', 'Online', 'Presenciais', 'Obrigatórios', 'Comunidade', 'Aulas ao vivo'].map(
            (item) => (
              <button
                className={eventFilter === item ? 'active' : ''}
                key={item}
                onClick={() => setEventFilter(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      {canCreateEvents && (createdByMeEvents.length > 0 || creatorAlertsForMe.length > 0) && (
        <section className="event-owner-panel">
          <div className="event-response-heading">
            <div>
              <span className="section-kicker">Meus eventos</span>
              <h3>Inscrições recebidas</h3>
              <p>Quem criou o evento vê quantidade de participantes e dados mínimos protegidos dos inscritos.</p>
            </div>
            <strong>{creatorAlertsForMe.length} nova(s) notificação(ões)</strong>
          </div>
          {creatorAlertsForMe.length > 0 && (
            <div className="event-alert-list">
              {creatorAlertsForMe.slice(0, 4).map((alert) => (
                <article key={alert.id}>
                  <strong>{alert.attendeeName} se inscreveu em {alert.eventTitle}</strong>
                  <small>{alert.attendeeEmailMasked} • {alert.createdAt}</small>
                </article>
              ))}
            </div>
          )}
          <div className="event-owner-grid">
            {createdByMeEvents.map((event) => {
              const eventId = eventIdFor(event);
              const registrations = registrationsFor(event);
              return (
                <article className="event-owner-card" key={`owner-${eventId}`}>
                  <header>
                    <span className="section-kicker">{event.mode ?? 'Online'}</span>
                    <strong>{event.title}</strong>
                    <small>{participantCountFor(event)}/{event.capacity ?? 60} participantes previstos</small>
                  </header>
                  {registrations.length === 0 ? (
                    <p>Nenhuma inscrição enviada ainda.</p>
                  ) : (
                    <div className="event-registrant-list">
                      {registrations.map((registration) => (
                        <article key={registration.id}>
                          <span>{getInitials(registration.fullName)}</span>
                          <div>
                            <strong>{registration.fullName}</strong>
                            <small>{registration.emailMasked} • {registration.whatsappMasked}</small>
                            <small>{registration.documentProvided ? 'Documento enviado e protegido' : 'Sem documento exigido'}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(confirmedEvents.length > 0 || declinedEvents.length > 0) && (
        <section className="event-response-board" data-event-response-board>
          <div className="event-response-heading">
            <div>
              <span className="section-kicker">Minha agenda</span>
              <h3>Eventos respondidos</h3>
              <p>Eventos confirmados e recusados saem da lista principal para deixar pendente apenas o que ainda precisa de resposta.</p>
            </div>
            <strong>{confirmedEvents.length} confirmado(s) / {declinedEvents.length} recusado(s)</strong>
          </div>

          <div className="event-response-columns">
            <section>
              <h4>Vou participar</h4>
              {confirmedEvents.length === 0 ? (
                <p className="empty-state compact">Nenhum evento confirmado ainda.</p>
              ) : (
                confirmedEvents.map((event) => {
                  const eventId = eventIdFor(event);
                  return (
                    <article className="event-response-card going" key={`going-${eventId}`}>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{event.date} às {event.time} - {event.type}</small>
                        <small>{event.owner}</small>
                      </div>
                      <div className="event-response-actions">
                        <a href={calendarHref(event)} target="_blank" rel="noreferrer">
                          Agendar no calendário
                        </a>
                        <button onClick={() => clearVote(eventId)}>Voltar para pendentes</button>
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <section>
              <h4>Recusados</h4>
              {declinedEvents.length === 0 ? (
                <p className="empty-state compact">Nenhum evento recusado ainda.</p>
              ) : (
                declinedEvents.map((event) => {
                  const eventId = eventIdFor(event);
                  return (
                    <article className="event-response-card declined" key={`declined-${eventId}`}>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{event.date} às {event.time} - {event.type}</small>
                        <small>{event.owner}</small>
                      </div>
                      <button onClick={() => clearVote(eventId)}>Voltar para pendentes</button>
                    </article>
                  );
                })
              )}
            </section>
          </div>
        </section>
      )}

      <div className="event-grid" data-event-list>
        {visibleEvents.map((event, index) => {
          const eventId = eventIdFor(event);
          const registrations = registrationsFor(event);
          const alreadyRegistered = registrations.some(
            (registration) => registration.accountEmail === currentUser?.email,
          );
          return (
          <article className="event-card" key={eventId}>
            <span>{`0${index + 1}`}</span>
            <strong>{event.title}</strong>
            <small>
              {event.type} - {event.owner}
            </small>
            <small>{event.mode ?? 'Online'} • {event.location ?? 'Local a definir'}</small>
            <small>{event.required ? 'Obrigatório do curso' : 'Opcional da comunidade'}</small>
            {event.description && <p>{event.description}</p>}
            <small>{event.date} às {event.time}</small>
            <div className="event-capacity-row">
              <strong>{Number(event.price ?? 0) > 0 ? formatCurrency(event.price) : 'Gratuito'}</strong>
              <span>{participantCountFor(event)}/{event.capacity ?? 60} vagas</span>
            </div>
            <div className="participant-stack">
              {(event.participants ?? []).slice(0, 3).map((person) => (
                <span key={person}>{getInitials(person)}</span>
              ))}
              {registrations.slice(0, 3).map((person) => (
                <span key={person.id}>{getInitials(person.fullName)}</span>
              ))}
              <small>{registrations.length} inscrito(s) pela plataforma</small>
            </div>
            <div className="vote-row">
              <button
                disabled={alreadyRegistered}
                onClick={() => startEventRegistration(event)}
              >
                {alreadyRegistered ? 'Inscrito' : 'Inscrever-se'}
              </button>
              <button
                onClick={() => vote(eventId, 'no')}
              >
                Não ({event.no + 1})
              </button>
            </div>
            <a href={calendarHref(event)} target="_blank" rel="noreferrer">
              Adicionar ao calendário
            </a>
          </article>
          );
        })}
      </div>
      {visibleEvents.length === 0 && (
        <p className="empty-state">Nenhum evento pendente encontrado com esses filtros.</p>
      )}
      {registrationEvent && (
        <div className="floating-backdrop" onClick={() => setRegistrationEvent(null)}>
          <section className="floating-modal event-payment-modal" onClick={(event) => event.stopPropagation()}>
            <span className="section-kicker">Inscrição</span>
            <h3>{registrationEvent.title}</h3>
            <p>{registrationEvent.date} às {registrationEvent.time} • {registrationEvent.location}</p>
            <div className="event-registration-form">
              <label>
                Nome completo
                <input
                  value={eventRegistrationDraft.fullName}
                  onChange={(event) => updateRegistrationDraft('fullName', event.target.value)}
                />
              </label>
              <label>
                Email real para confirmação
                <input
                  type="email"
                  value={eventRegistrationDraft.email}
                  onChange={(event) => updateRegistrationDraft('email', event.target.value)}
                />
              </label>
              <label>
                WhatsApp
                <input
                  value={eventRegistrationDraft.whatsapp}
                  onChange={(event) => updateRegistrationDraft('whatsapp', event.target.value)}
                  placeholder="+55 00 00000-0000"
                />
              </label>
              <label>
                Empresa ou organização
                <input
                  value={eventRegistrationDraft.company}
                  onChange={(event) => updateRegistrationDraft('company', event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              {(registrationEvent.requiredFields ?? []).includes('document') && (
                <label>
                  CPF/CNPJ para conferência
                  <input
                    value={eventRegistrationDraft.documentNumber}
                    onChange={(event) => updateRegistrationDraft('documentNumber', event.target.value)}
                    placeholder="Documento protegido"
                  />
                </label>
              )}
            </div>
            <p className="policy-note">
              Os dados de contato ficam protegidos; o criador vê apenas o necessário para confirmar presença.
            </p>
            {Number(registrationEvent.price ?? 0) > 0 ? (
              <>
                <strong className="event-payment-total">{formatCurrency(registrationEvent.price)}</strong>
                <div className="payment-methods compact-payment-methods">
                  {['pix', 'card', 'boleto'].map((method) => (
                    <button
                      className={eventPaymentMethod === method ? 'active' : ''}
                      key={method}
                      type="button"
                      onClick={() => setEventPaymentMethod(method)}
                    >
                      {method === 'pix' ? 'Pix' : method === 'card' ? 'Cartão' : 'Boleto'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <strong className="event-payment-total">Evento gratuito</strong>
            )}
            {eventPaymentNotice && <p className="valid-note">{eventPaymentNotice}</p>}
            <div className="button-row">
              <button type="button" onClick={confirmEventRegistration}>
                {Number(registrationEvent.price ?? 0) > 0 ? 'Confirmar pagamento e inscrição' : 'Confirmar inscrição'}
              </button>
              <button className="light" type="button" onClick={() => setRegistrationEvent(null)}>Cancelar</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

// Tela Perfil: login, cadastro, dados publicos, documentos, pontos e painel por segmento.
function ProfileView({
  posts = [],
  enrollments,
  courseProgress,
  coursePaymentStatus,
  completeLesson,
  profilePhoto,
  setProfilePhoto,
  currentUser,
  authToken,
  activateUserSession,
  authMode,
  setAuthMode,
  openPage,
  courses,
  profileResumeName,
  setProfileResumeName,
  profilePublicInfo,
  setProfilePublicInfo,
  userPoints,
  notifications,
  notificationPrefs,
  setNotificationPrefs,
  socialGraph,
  followProfile,
  blockProfile,
  unblockProfile,
  removeFollower,
  acceptIncomingFriendRequest,
  rejectIncomingFriendRequest,
  communityEvents,
  jobs,
  benefits,
  createBenefit,
  benefitRequests,
  approveBenefitRequest,
  rejectBenefitRequest,
  benefitEmailDeliveries,
  visualPreferences,
  setVisualPreferences,
  openPrivacyCenter,
}) {
  const enrolledCourses = courses.filter((course) =>
    enrollments.includes(course.id),
  );
  const [activeProfilePanel, setActiveProfilePanel] = useState('');
  const ownProfilePosts = getOwnProfilePosts(currentUser, posts);
  const ownProfileEvents = getOwnProfileEvents(currentUser, communityEvents);
  const ownProfileOpportunities = getOwnProfileOpportunities(currentUser, jobs);
  const ownSocialStats = currentUser
    ? getOwnProfileStats(socialGraph, ownProfilePosts, ownProfileEvents, ownProfileOpportunities)
    : { friends: 0, followers: 0, following: 0, posts: 0, events: 0, opportunities: 0 };
  const ownSocialProfile = getCurrentUserSocialProfile(currentUser, profilePublicInfo, profilePhoto);
  const isOperationalProfile = ['platform', 'employee'].includes(currentUser?.segment);

  useEffect(() => {
    if (currentUser) return;
    const signup = new URL(window.location.href).searchParams.get('signup');
    if (signup) setAuthMode('signup');
  }, [currentUser, setAuthMode]);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfilePhoto(URL.createObjectURL(file));
  }

  async function loginWithEmail(email, password, consent = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await loginRequest(normalizedEmail, password, consent);
    const account = mapBackendUserToAccount(result.user, {
      email: normalizedEmail,
      termsConsent: result.termsConsent ?? createTermsConsentRecord(normalizedEmail),
      privacyConsent: result.privacyConsent ?? createPrivacyConsentRecord(normalizedEmail),
    });
    activateUserSession(account, result.accessToken);
  }

  if (!currentUser) {
    return (
      <section>
        {authMode === 'login' && (
          <>
            <PageHeader
              label="Entrar"
              title="Entrar na conta"
              description="Digite email e senha. O sistema reconhece automaticamente se a conta é PF, PJ, Empresa ou acesso interno."
            />
            <LoginPanel
              loginWithEmail={loginWithEmail}
              setAuthMode={setAuthMode}
              openPrivacyCenter={openPrivacyCenter}
            />
          </>
        )}
        {authMode === 'signup' && (
          <SignupView
            setAuthMode={setAuthMode}
            loginWithEmail={loginWithEmail}
            openPrivacyCenter={openPrivacyCenter}
            openPage={openPage}
          />
        )}
        {authMode === 'forgot' && (
          <ForgotPasswordView setAuthMode={setAuthMode} />
        )}
      </section>
    );
  }

  return (
    <section className="profile-authenticated-page">
      {isOperationalProfile ? (
        <OperationalProfileHeader currentUser={currentUser} authToken={authToken} />
      ) : (
        <ProfileHero
          currentUser={currentUser}
          profilePhoto={profilePhoto}
          setProfilePhoto={setProfilePhoto}
          profilePublicInfo={profilePublicInfo}
          setProfilePublicInfo={setProfilePublicInfo}
          userPoints={userPoints}
          socialStats={ownSocialStats}
          onOpenSocialPanel={setActiveProfilePanel}
          benefits={benefits}
          openPage={openPage}
        />
      )}

      <section className="profile-card privacy-settings-card">
        <div>
          <span className="section-kicker">Privacidade</span>
          <h3>Termos de Uso e Privacidade</h3>
          <p>
            Revise o consentimento, versões aceitas e regras de uso de dados para mensagens,
            networking, cursos, oportunidades, eventos e benefícios.
          </p>
        </div>
        <button type="button" onClick={openPrivacyCenter}>Privacidade e Uso de Dados</button>
      </section>

      {!isOperationalProfile && activeProfilePanel && (
        <ProfileSocialPanel
          activePanel={activeProfilePanel}
          setActivePanel={setActiveProfilePanel}
          socialGraph={socialGraph}
          currentUserProfile={ownSocialProfile}
          profilePosts={ownProfilePosts}
          profileEvents={ownProfileEvents}
          profileOpportunities={ownProfileOpportunities}
          followProfile={followProfile}
          blockProfile={blockProfile}
          unblockProfile={unblockProfile}
          removeFollower={removeFollower}
        />
      )}

      {!isOperationalProfile && (
        <SystemCustomizationPanel
          preferences={visualPreferences}
          setPreferences={setVisualPreferences}
        />
      )}

      <div className="profile-grid">
        {!isOperationalProfile && (
          <ProfileNotificationsCard
            userPoints={userPoints}
            notifications={notifications}
            notificationPrefs={notificationPrefs}
            setNotificationPrefs={setNotificationPrefs}
            socialGraph={socialGraph}
            onOpenSocialPanel={setActiveProfilePanel}
            acceptIncomingFriendRequest={acceptIncomingFriendRequest}
            rejectIncomingFriendRequest={rejectIncomingFriendRequest}
          />
        )}

        <section className="profile-card session-safety-card">
          <span className="section-kicker">Sessão isolada</span>
          <h3>{getAccountTypeLabel(currentUser)}</h3>
          <p>
            Dados de cursos, pontos, currículo, candidaturas e benefícios ficam
            separados por conta ativa. Trocar de Pessoa Física, Pessoa Jurídica,
            Empresa ou equipe interna não reaproveita o estado do perfil anterior.
          </p>
          <div className="session-identity-grid">
            <span>Acesso</span>
            <strong>{maskEmail(currentUser.email)}</strong>
            <span>Email real</span>
            <strong>{maskEmail(getContactEmail(currentUser))}</strong>
            <span>Perfil</span>
            <strong>{getAccountTypeCode(currentUser)}</strong>
            <span>Escopo</span>
            <strong>{currentUser.backendUser ? 'JWT validado' : 'Sessão não validada'}</strong>
          </div>
        </section>

        {!isOperationalProfile && <SensitiveDataVerificationCard currentUser={currentUser} />}

        {['student', 'teacher'].includes(currentUser?.segment) && (
          <PublicProfileEditor
            profilePublicInfo={profilePublicInfo}
            setProfilePublicInfo={setProfilePublicInfo}
            profileResumeName={profileResumeName}
            setProfileResumeName={setProfileResumeName}
          />
        )}

        {currentUser?.segment === 'student' && (
          <PessoaFisicaProfile
            enrolledCourses={enrolledCourses}
            courseProgress={courseProgress}
            coursePaymentStatus={coursePaymentStatus}
            completeLesson={completeLesson}
            openPage={openPage}
          />
        )}
        {currentUser?.segment === 'teacher' && (
          <PessoaJuridicaProfile currentUser={currentUser} openPage={openPage} />
        )}
        {currentUser?.segment === 'company' && <CompanyProfile openPage={openPage} />}
        {currentUser?.segment === 'employee' && <EmployeeProfile currentUser={currentUser} />}
        {currentUser?.segment === 'platform' && (
          <PlatformProfile
            authToken={authToken}
            benefits={benefits}
            createBenefit={createBenefit}
            benefitRequests={benefitRequests}
            approveBenefitRequest={approveBenefitRequest}
            rejectBenefitRequest={rejectBenefitRequest}
            benefitEmailDeliveries={benefitEmailDeliveries}
          />
        )}

        {currentUser?.segment === 'student' && (
          <section className="profile-card blue">
            <span className="section-kicker">Documentos</span>
            <h3>CPF, RG e documentos protegidos</h3>
            <p>
              Alterar CPF/RG exige autenticação, documento enviado e validação de
              veracidade. Dados sensíveis não podem ser editados livremente.
            </p>
            <FileUpload label="RG" action="Enviar RG para verificação" accept=".pdf,image/*" />
            <FileUpload label="CPF" action="Enviar CPF para verificação" accept=".pdf,image/*" />
            <button>Solicitar verificação</button>
          </section>
        )}

        {currentUser?.segment === 'teacher' && (
          <section className="profile-card blue">
            <span className="section-kicker">Documentos PJ</span>
            <h3>CNPJ, contrato e responsável legal</h3>
            <p>
              Alterar dados jurídicos exige autenticação, documento atualizado e
              validação da empresa ou da plataforma.
            </p>
            <FileUpload label="CNPJ" action="Enviar comprovante de CNPJ" accept=".pdf,image/*" />
            <FileUpload label="Contrato ou MEI" action="Enviar documento PJ" accept=".pdf,image/*" />
            <FileUpload label="Responsável legal" action="Enviar documento" accept=".pdf,image/*" />
            <button>Solicitar verificação PJ</button>
          </section>
        )}
      </div>
    </section>
  );
}

// Dados sensiveis: impede alteracao direta de email, WhatsApp e documentos sem verificacao.
function SensitiveDataVerificationCard({ currentUser }) {
  const [field, setField] = useState('email');
  const [requestedValue, setRequestedValue] = useState('');
  const [notice, setNotice] = useState('');

  const fieldLabels = {
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    document: 'Documento',
  };

  function requestVerification() {
    const value = requestedValue.trim();
    if (!value) {
      setNotice('Informe o novo dado antes de solicitar verificação.');
      return;
    }
    setNotice(`${fieldLabels[field]} enviado para conferência. A alteração só será liberada após validação.`);
    setRequestedValue('');
  }

  return (
    <section className="profile-card sensitive-data-card">
      <span className="section-kicker">Dados protegidos</span>
      <h3>Alterações com verificação</h3>
      <p>
        E-mail, WhatsApp, CPF, RG, CNPJ e documentos não são alterados direto no perfil.
        A plataforma valida autenticidade antes de aplicar a mudança.
      </p>
      <div className="protected-data-summary">
        <span>Acesso</span>
        <strong>{maskEmail(currentUser.email)}</strong>
        <span>Email real</span>
        <strong>{maskEmail(getContactEmail(currentUser))}</strong>
        <span>Tipo</span>
        <strong>{getAccountTypeLabel(currentUser)}</strong>
      </div>
      <label>
        Dado que deseja alterar
        <select value={field} onChange={(event) => setField(event.target.value)}>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="document">CPF, RG, CNPJ ou contrato</option>
        </select>
      </label>
      <label>
        Novo valor
        <input
          value={requestedValue}
          onChange={(event) => setRequestedValue(event.target.value)}
          placeholder={field === 'email' ? 'novo@email.com' : field === 'whatsapp' ? '+55 11 99999-0000' : 'Número ou descrição do documento'}
        />
      </label>
      {field === 'document' && (
        <FileUpload label="Anexo de comprovação" action="Enviar documento" accept=".pdf,image/*" />
      )}
      <button type="button" onClick={requestVerification}>
        Solicitar verificação
      </button>
      {notice && <p className={notice.startsWith('Informe') ? 'invalid-note' : 'valid-note'}>{notice}</p>}
    </section>
  );
}

function ProfileNotificationsCard({
  userPoints,
  notifications,
  notificationPrefs,
  setNotificationPrefs,
  socialGraph,
  onOpenSocialPanel,
  acceptIncomingFriendRequest,
  rejectIncomingFriendRequest,
}) {
  const incomingRequests = getConnectionProfiles(socialGraph.incomingFriendRequestHandles);

  return (
    <section className="profile-card points-profile-card" data-profile-target="notifications">
      <div className="profile-card-heading">
        <div>
          <span className="section-kicker">Pontos e notificações</span>
          <h3>{userPoints} pontos acumulados</h3>
        </div>
        <button className="light" type="button" onClick={() => onOpenSocialPanel('blocked')}>
          Bloqueados
        </button>
      </div>
      <p>Notificações sociais, cursos, candidaturas, pontos e benefícios aparecem aqui em ordem recente.</p>

      {incomingRequests.length > 0 && (
        <div className="social-request-list">
          {incomingRequests.map((profile) => (
            <article key={profile.handle}>
              <Avatar initials={profile.initials} photo={profile.photo} />
              <div>
                <strong>{profile.name}</strong>
                <small>enviou uma solicitação de amizade</small>
              </div>
            <button className="compact-social-button" type="button" onClick={() => acceptIncomingFriendRequest(profile.handle)}>
              Aceitar
            </button>
              <button className="light compact-social-button" type="button" onClick={() => rejectIncomingFriendRequest(profile.handle)}>
                Recusar
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="notification-list notification-list-full">
        {notifications.length === 0 ? (
          <p className="empty-state">Nenhuma notificação nova.</p>
        ) : notifications.map((notice) => {
          const actor = notice.actorHandle ? getSocialProfileByHandle(notice.actorHandle) : null;
          return (
            <article key={notice.id}>
              <strong>{notice.title}</strong>
              <small>
                {actor ? `${actor.name} • ` : ''}
                Canal: {notice.channel}
              </small>
            </article>
          );
        })}
      </div>

      <div className="permission-chip-grid">
        {['celular', 'computador', 'email'].map((channel) => (
          <label className={notificationPrefs[channel] ? 'permission-chip active' : 'permission-chip'} key={channel}>
            <input
              type="checkbox"
              checked={notificationPrefs[channel]}
              onChange={() => setNotificationPrefs((current) => ({ ...current, [channel]: !current[channel] }))}
            />
            Notificar por {channel}
          </label>
        ))}
      </div>
    </section>
  );
}

function ProfileSocialPanel({
  activePanel,
  setActivePanel,
  socialGraph,
  currentUserProfile,
  profilePosts = [],
  profileEvents,
  profileOpportunities,
  followProfile,
  blockProfile,
  unblockProfile,
  removeFollower,
}) {
  const panelLabels = {
    friends: 'Amigos',
    followers: 'Seguidores',
    following: 'Seguindo',
    posts: 'Posts',
    events: 'Eventos',
    opportunities: 'Oportunidades',
    blocked: 'Bloqueados',
  };
  const followerProfiles = getConnectionProfiles(socialGraph.followerHandles);
  const friendProfiles = getConnectionProfiles(socialGraph.friendHandles);
  const followingProfiles = getConnectionProfiles(socialGraph.followingHandles);
  const blockedProfiles = getConnectionProfiles(socialGraph.blockedHandles);
  const currentTitle = panelLabels[activePanel] ?? 'Conexões';

  function renderConnectionRows(profiles, emptyMessage) {
    if (!profiles.length) return <p className="empty-state">{emptyMessage}</p>;

    return (
      <div className="social-connection-list own-social-list">
        {profiles.map((profile) => {
          const blocked = socialGraph.blockedHandles.includes(profile.handle);
          const following = socialGraph.followingHandles.includes(profile.handle);
          return (
            <article key={profile.handle}>
              <Avatar initials={profile.initials} photo={profile.photo} />
              <div>
                <strong>{profile.name}</strong>
                <small>{profile.handle} • {profile.city}</small>
              </div>
              {activePanel !== 'blocked' && (
                <button className="light compact-social-button" type="button" onClick={() => followProfile(profile.handle)}>
                  {following ? 'Deixar de seguir' : 'Seguir'}
                </button>
              )}
              {activePanel === 'followers' && (
                <button className="light compact-social-button" type="button" onClick={() => removeFollower(profile.handle)}>
                  Remover
                </button>
              )}
              <button
                className={blocked ? 'light compact-social-button' : 'danger-soft compact-social-button'}
                type="button"
                onClick={() => (blocked ? unblockProfile(profile.handle) : blockProfile(profile.handle))}
              >
                {blocked ? 'Desbloq.' : 'Bloq.'}
              </button>
            </article>
          );
        })}
      </div>
    );
  }

  function renderPanelContent() {
    if (activePanel === 'followers') {
      return renderConnectionRows(followerProfiles, 'Nenhum seguidor público para mostrar agora.');
    }
    if (activePanel === 'following') {
      return renderConnectionRows(followingProfiles, 'Você ainda não está seguindo perfis públicos.');
    }
    if (activePanel === 'friends') {
      return renderConnectionRows(friendProfiles, 'Nenhum amigo aceito ainda.');
    }
    if (activePanel === 'blocked') {
      return renderConnectionRows(blockedProfiles, 'Nenhum perfil bloqueado.');
    }
    if (activePanel === 'posts') {
      return profilePosts.length ? (
        <div className="social-mini-list">
          {profilePosts.map((post) => (
            <article key={post.id}>
              <strong>{post.tag}</strong>
              <small>{post.city} • {post.createdAt ?? 'Agora'}</small>
              <p>{post.body}</p>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Nenhum post publicado por este perfil.</p>;
    }
    if (activePanel === 'events') {
      return profileEvents.length ? (
        <div className="social-mini-list">
          {profileEvents.map((event) => (
            <article key={`${event.title}-${event.date}-${event.time}`}>
              <strong>{event.title}</strong>
              <small>{event.mode} • {event.date} às {event.time}</small>
              <p>{event.description}</p>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Nenhum evento publicado por este perfil.</p>;
    }
    if (activePanel === 'opportunities') {
      return profileOpportunities.length ? (
        <div className="social-mini-list">
          {profileOpportunities.map((job) => (
            <article key={job.id}>
              <strong>{job.title}</strong>
              <small>{job.company} • {job.city}</small>
              <p>{job.type} disponível • {job.salary}</p>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Nenhuma oportunidade ativa neste perfil.</p>;
    }

    return null;
  }

  return (
    <section className="profile-card profile-social-panel">
      <div className="profile-card-heading">
        <div>
          <span className="section-kicker">Rede social</span>
          <h3>{currentTitle}</h3>
          <p>{currentUserProfile.name} • {currentUserProfile.handle}</p>
        </div>
        <button className="light" type="button" onClick={() => setActivePanel('')}>
          Fechar
        </button>
      </div>
      {renderPanelContent()}
    </section>
  );
}

function PublicProfileEditor({
  profilePublicInfo,
  setProfilePublicInfo,
  profileResumeName,
  setProfileResumeName,
}) {
  const [saveNotice, setSaveNotice] = useState('');

  function update(field, value) {
    setProfilePublicInfo((current) => ({ ...current, [field]: value }));
    setSaveNotice('');
  }

  function saveProfile() {
    setSaveNotice('Perfil atualizado na prévia e salvo nesta sessão.');
  }

  return (
    <section className="profile-card public-profile-editor">
      <div className="profile-card-heading">
        <div>
          <span className="section-kicker">Editar perfil</span>
          <h3>Informações públicas</h3>
        </div>
        {saveNotice && <small className="valid-note">{saveNotice}</small>}
      </div>
      <label>
        Nome público
        <input
          value={profilePublicInfo.displayName}
          onChange={(event) => update('displayName', event.target.value)}
          placeholder="Nome que aparece no perfil"
        />
      </label>
      <label>
        Biografia
        <textarea
          value={profilePublicInfo.bio}
          onChange={(event) => update('bio', event.target.value)}
          placeholder="Resumo curto sobre você"
        />
      </label>
      <label>
        Cidade
        <input
          value={profilePublicInfo.city}
          onChange={(event) => update('city', event.target.value)}
          placeholder="Cidade, UF"
        />
      </label>
      <FileUpload
        label="Currículo"
        action={profileResumeName || 'Enviar currículo'}
        accept=".pdf,.doc,.docx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setProfileResumeName(file.name);
        }}
      />
      <label>
        LinkedIn
        <input
          value={profilePublicInfo.linkedin}
          onChange={(event) => update('linkedin', event.target.value)}
          placeholder="linkedin.com/in/seu-perfil"
        />
      </label>
      <label>
        Instagram
        <input
          value={profilePublicInfo.instagram}
          onChange={(event) => update('instagram', event.target.value)}
          placeholder="@usuario"
        />
      </label>
      <label>
        GitHub
        <input
          value={profilePublicInfo.github}
          onChange={(event) => update('github', event.target.value)}
          placeholder="github.com/usuario"
        />
      </label>
      <button type="button" onClick={saveProfile}>
        Salvar perfil
      </button>
    </section>
  );
}

// Capa do proprio perfil: foto, capa, resumo publico e atalhos internos da conta.
function ProfileHero({
  currentUser,
  profilePhoto,
  setProfilePhoto,
  profilePublicInfo,
  setProfilePublicInfo,
  userPoints,
  socialStats,
  onOpenSocialPanel,
  benefits = [],
  openPage,
}) {
  const handle = getUserHandle(currentUser);
  const displayName = profilePublicInfo.displayName || currentUser?.name;
  const [cropEditor, setCropEditor] = useState(null);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const redeemableBenefits = useMemo(
    () =>
      [...benefits].sort(
        (left, right) =>
          Number(left.pointsCost ?? 0) - Number(right.pointsCost ?? 0),
      ),
    [benefits],
  );

  function closeCropEditor() {
    if (cropEditor?.sourceUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(cropEditor.sourceUrl);
    }
    setCropEditor(null);
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropEditor({
      target: 'photo',
      sourceUrl: URL.createObjectURL(file),
      outputWidth: 720,
      outputHeight: 720,
      shape: 'avatar',
      kicker: 'Foto de perfil',
      title: 'Ajustar corte da foto',
      description: 'Use zoom e movimento para definir como sua foto aparecerá no perfil.',
    });
  }

  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropEditor({
      target: 'cover',
      sourceUrl: URL.createObjectURL(file),
      outputWidth: 1800,
      outputHeight: 560,
      shape: 'cover',
      kicker: 'Capa do perfil',
      title: 'Ajustar corte da capa',
      description: 'A capa é larga. Posicione a imagem para não cortar rostos, textos ou detalhes importantes.',
    });
  }

  function applyCroppedImage(dataUrl) {
    if (cropEditor?.target === 'photo') {
      setProfilePhoto(dataUrl);
      closeCropEditor();
      return;
    }

    setProfilePublicInfo((current) => ({
      ...current,
      coverPhoto: dataUrl,
    }));
    closeCropEditor();
  }

  function scrollToProfileSection(selector) {
    const target = document.querySelector(selector);
    if (!target) return;

    const fixedHeaderOffset = 86;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - fixedHeaderOffset;

    window.scrollTo({
      behavior: 'smooth',
      top: Math.max(targetTop, 0),
    });
  }

  return (
    <section className="modern-profile-hero">
      <label className="profile-cover-upload">
        <div
          className={profilePublicInfo.coverPhoto ? 'profile-cover-band has-cover' : 'profile-cover-band'}
          style={profilePublicInfo.coverPhoto ? { '--profile-cover-image': `url(${profilePublicInfo.coverPhoto})` } : undefined}
        />
        <input type="file" accept="image/*" onChange={handleCoverChange} />
        <span>{profilePublicInfo.coverPhoto ? 'Trocar capa' : 'Adicionar capa'}</span>
      </label>
      <div className="modern-profile-main">
        <label className="profile-avatar-upload">
          <Avatar initials={getInitials(displayName || 'MP')} photo={profilePhoto} />
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
          <span className="profile-avatar-action">{profilePhoto ? 'Trocar foto' : 'Adicionar foto'}</span>
        </label>
        <div className="modern-profile-copy">
          <span className="section-kicker">{getAccountTypeLabel(currentUser)}</span>
          <h2>{displayName}</h2>
          <p>{handle} • {getAccountTypeLabel(currentUser)} • {profilePublicInfo.city}</p>
          <small>{profilePublicInfo.bio}</small>
        </div>
        <div className="profile-owner-actions">
          <button
            type="button"
            onClick={() =>
              scrollToProfileSection(
                '.public-profile-editor, .company-profile-card, .employee-profile-card, .platform-admin-card, .profile-grid',
              )
            }
          >
            Editar perfil
          </button>
          <button
            className="light profile-notifications-action"
            type="button"
            onClick={() => scrollToProfileSection('[data-profile-target="notifications"]')}
          >
            Notificações
          </button>
        </div>
      </div>
      <div className="modern-profile-stats">
        <button className="profile-stat-card" type="button" onClick={() => setPointsModalOpen(true)}><strong>{formatExactCount(userPoints)}</strong><span>{formatCountLabel(userPoints, 'ponto', 'pontos')}</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('friends')}><strong>{formatExactCount(socialStats.friends)}</strong><span>{formatCountLabel(socialStats.friends, 'amigo', 'amigos')}</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('followers')}><strong>{formatExactCount(socialStats.followers)}</strong><span>{formatCountLabel(socialStats.followers, 'seguidor', 'seguidores')}</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('following')}><strong>{formatExactCount(socialStats.following)}</strong><span>seguindo</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('posts')}><strong>{formatExactCount(socialStats.posts)}</strong><span>{formatCountLabel(socialStats.posts, 'post', 'posts')}</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('events')}><strong>{formatExactCount(socialStats.events)}</strong><span>{formatCountLabel(socialStats.events, 'evento', 'eventos')}</span></button>
        <button className="profile-stat-card" type="button" onClick={() => onOpenSocialPanel('opportunities')}><strong>{formatExactCount(socialStats.opportunities)}</strong><span>{formatCountLabel(socialStats.opportunities, 'oportunidade', 'oportunidades')}</span></button>
      </div>
      {pointsModalOpen && (
        <ProfilePointsModal
          benefits={redeemableBenefits}
          onClose={() => setPointsModalOpen(false)}
          openPage={openPage}
          userPoints={userPoints}
        />
      )}
      {cropEditor && (
        <ImageCropModal
          editor={cropEditor}
          onCancel={closeCropEditor}
          onConfirm={applyCroppedImage}
        />
      )}
    </section>
  );
}

function ProfilePointsModal({ benefits, onClose, openPage, userPoints }) {
  const availableBenefits = benefits.filter(
    (benefit) => Number(benefit.pointsCost ?? 0) <= userPoints,
  );
  const nextBenefits = benefits.filter(
    (benefit) => Number(benefit.pointsCost ?? 0) > userPoints,
  );

  function openBenefitsPage() {
    onClose();
    openPage?.('benefits');
  }

  return (
    <div className="floating-backdrop profile-points-backdrop" onClick={onClose}>
      <section className="floating-modal profile-points-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-button" type="button" onClick={onClose}>
          Fechar
        </button>
        <span className="section-kicker">Carteira de pontos</span>
        <h3>{formatExactCount(userPoints)} {formatCountLabel(userPoints, 'ponto disponível', 'pontos disponíveis')}</h3>
        <p>
          Use seus pontos para trocar por benefícios, cupons, ingressos e vantagens de parceiros.
        </p>

        <div className="points-benefit-summary">
          <article>
            <strong>{availableBenefits.length}</strong>
            <span>disponíveis agora</span>
          </article>
          <article>
            <strong>{nextBenefits.length}</strong>
            <span>faltando pontos</span>
          </article>
        </div>

        <div className="points-benefit-list">
          {benefits.length ? (
            benefits.map((benefit) => {
              const cost = Number(benefit.pointsCost ?? 0);
              const canRedeem = cost <= userPoints;
              return (
                <article className={canRedeem ? 'points-benefit-item available' : 'points-benefit-item'} key={benefit.id}>
                  <div>
                    <strong>{benefit.title}</strong>
                    <span>{benefit.partner} • {benefit.category}</span>
                  </div>
                  <div>
                    <b>{formatExactCount(cost)} pts</b>
                    <small>{canRedeem ? 'Pode trocar' : `Faltam ${formatExactCount(cost - userPoints)} pts`}</small>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty-state">Nenhum benefício cadastrado para troca por pontos.</p>
          )}
        </div>

        <div className="button-row">
          <button type="button" onClick={openBenefitsPage}>Ver benefícios</button>
          <button className="light" type="button" onClick={onClose}>Continuar no perfil</button>
        </div>
      </section>
    </div>
  );
}

function OperationalProfileHeader({ currentUser, authToken }) {
  const roleLabel = currentUser?.segment === 'platform'
    ? 'Administrador central'
    : 'Funcionário operacional';

  return (
    <section className="profile-card yellow operational-profile-header">
      <div className="profile-card-heading">
        <div>
          <span className="section-kicker">Acesso operacional</span>
          <h2>{roleLabel}</h2>
          <p>{currentUser?.name} • {maskEmail(currentUser?.email)}</p>
        </div>
        <div className="session-identity-grid operational-identity-grid">
          <span>Permissão</span>
          <strong>{currentUser?.platformRole ?? currentUser?.role ?? 'Operação'}</strong>
          <span>API admin</span>
          <strong>{authToken ? 'Token ativo' : 'Sem token'}</strong>
          <span>Escopo</span>
          <strong>{currentUser?.segment === 'platform' ? 'Toda plataforma' : 'Suporte designado'}</strong>
        </div>
      </div>
      <p>
        Esta área é focada em gestão, suporte e manutenção. Recursos sociais como capa,
        seguidores, amigos e pontos não fazem parte do perfil operacional.
      </p>
    </section>
  );
}

function OperationalSupportConsole({ mode = 'employee', employees = [], tickets = [] }) {
  const defaultInternal = employees.length
    ? employees.map((employee) => ({
        id: employee.id ?? employee.email,
        name: employee.name,
        meta: employee.email,
        unread: 0,
      }))
    : [];
  const defaultQueue = tickets.length
    ? tickets.map((ticket) => ({
        id: ticket.id,
        name: ticket.owner,
        meta: ticket.title,
        unread: ticket.priority === 'Alta' ? 2 : 1,
      }))
    : [];
  const channels = [
    ...defaultInternal.map((item) => ({ ...item, type: 'Interno' })),
    ...defaultQueue.map((item) => ({ ...item, type: 'Suporte' })),
  ];
  const [activeChannelId, setActiveChannelId] = useState(channels[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(() =>
    Object.fromEntries(
      channels.map((channel) => [
        channel.id,
        [
          {
            id: `${channel.id}-initial`,
            author: channel.type === 'Interno' ? channel.name : 'Solicitante',
            body: channel.type === 'Interno'
              ? 'Canal operacional aberto para alinhamento de atendimento.'
              : channel.meta,
            time: 'Agora',
          },
        ],
      ]),
    ),
  );
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0];
  const activeMessages = messages[activeChannel?.id] ?? [];

  function sendOperationalMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeChannel) return;
    setMessages((current) => ({
      ...current,
      [activeChannel.id]: [
        ...(current[activeChannel.id] ?? []),
        {
          id: `ops-message-${Date.now()}`,
          author: mode === 'platform' ? 'Admin' : 'Funcionário',
          body,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    }));
    setDraft('');
  }

  return (
    <section className="module-card operational-support-console">
      <div className="profile-card-heading">
        <div>
          <span className="section-kicker">Atendimento</span>
          <h3>{mode === 'platform' ? 'Equipe e fila de suporte' : 'Fila de suporte e equipe interna'}</h3>
          <p>Converse com funcionários e pessoas aguardando atendimento humano.</p>
        </div>
      </div>
      {channels.length === 0 ? (
        <p className="empty-state">Nenhum funcionário ou ticket de suporte aberto ainda.</p>
      ) : (
      <div className="private-chat-grid operational-chat-grid">
        <div className="private-conversation-list">
          {channels.map((channel) => (
            <button
              className={activeChannel?.id === channel.id ? 'private-conversation-button active' : 'private-conversation-button'}
              key={channel.id}
              type="button"
              onClick={() => setActiveChannelId(channel.id)}
            >
              <Avatar initials={getInitials(channel.name)} />
              <span className="private-conversation-summary">
                <strong className="private-conversation-name">{channel.name}</strong>
                <bdi className="private-conversation-preview">{channel.type} • {channel.meta}</bdi>
              </span>
              {channel.unread > 0 && <em>{channel.unread}</em>}
            </button>
          ))}
        </div>
        <section className="private-thread">
          <div className="private-thread-head">
            <Avatar initials={getInitials(activeChannel?.name ?? 'MP')} />
            <div>
              <strong>{activeChannel?.name ?? 'Atendimento'}</strong>
              <small>{activeChannel?.type ?? 'Operação'} • {activeChannel?.meta ?? 'Sem contexto'}</small>
            </div>
          </div>
          <div className="private-thread-messages">
            {activeMessages.map((message) => (
              <article className={message.author === 'Admin' || message.author === 'Funcionário' ? 'mine' : ''} key={message.id}>
                <strong>{message.author}</strong>
                <p>{message.body}</p>
                <small>{message.time}</small>
              </article>
            ))}
          </div>
          <form className="private-thread-composer" onSubmit={sendOperationalMessage}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Responder no atendimento"
            />
            <button type="submit">Enviar</button>
          </form>
        </section>
      </div>
      )}
    </section>
  );
}

function getRelativeLuminance(hexColor) {
  const normalized = hexColor.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
  const [lr, lg, lb] = [r, g, b].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function getContrastRatio(foreground, background) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableTextColor(background, preferredText = '') {
  if (preferredText && getContrastRatio(preferredText, background) >= 4.5) {
    return preferredText;
  }

  const darkText = '#111318';
  const lightText = '#ffffff';
  return getContrastRatio(darkText, background) >= getContrastRatio(lightText, background)
    ? darkText
    : lightText;
}

// Personalizacao visual: controla tema, cores e filtros de imagem do prototipo.
function SystemCustomizationPanel({ preferences, setPreferences }) {
  const [isOpen, setIsOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState(() => ({
    primary: preferences.primary ?? defaultVisualPreferences.primary,
    secondary: preferences.secondary ?? defaultVisualPreferences.secondary,
    button: preferences.button ?? defaultVisualPreferences.button,
    highlight: preferences.highlight ?? defaultVisualPreferences.highlight,
    text: preferences.text ?? defaultVisualPreferences.text,
  }));
  const [confirmNotice, setConfirmNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setColorDraft({
      primary: preferences.primary ?? defaultVisualPreferences.primary,
      secondary: preferences.secondary ?? defaultVisualPreferences.secondary,
      button: preferences.button ?? defaultVisualPreferences.button,
      highlight: preferences.highlight ?? defaultVisualPreferences.highlight,
      text: preferences.text ?? defaultVisualPreferences.text,
    });
    setConfirmNotice('');
  }, [
    isOpen,
    preferences.primary,
    preferences.secondary,
    preferences.button,
    preferences.highlight,
    preferences.text,
  ]);

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function updateColorDraft(key, value) {
    setColorDraft((current) => ({ ...current, [key]: value }));
    setConfirmNotice('');
  }

  function confirmCustomColors() {
    setPreferences((current) => ({
      ...current,
      mode: 'custom',
      ...colorDraft,
    }));
    setConfirmNotice('Cores aplicadas somente nesta conta.');
  }

  const buttonText = getReadableTextColor(colorDraft.button);
  const highlightText = getReadableTextColor(colorDraft.highlight);
  const textPreviewBackground =
    getContrastRatio(colorDraft.text, '#fffdf7') >= getContrastRatio(colorDraft.text, '#111318')
      ? '#fffdf7'
      : '#111318';

  return (
    <>
      <section className="profile-card system-customization-panel system-customization-trigger">
        <div>
          <span className="section-kicker">Personalização</span>
          <h3>Aparência</h3>
        <p>Tema, cor das letras e filtros da interface.</p>
        </div>
        <button type="button" onClick={() => setIsOpen(true)}>
          Personalizar
        </button>
      </section>

      {isOpen && (
        <div className="floating-backdrop" onClick={() => setIsOpen(false)}>
          <section
            className="floating-modal system-customization-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close-button" type="button" onClick={() => setIsOpen(false)}>
              Fechar
            </button>
            <div>
        <span className="section-kicker">Personalização</span>
        <h3>Aparência da plataforma</h3>
        <p>As escolhas ficam salvas na sessão da conta ativa. Outras contas não herdam essas cores.</p>
      </div>

      <div className="theme-mode-switch" role="group" aria-label="Modo do tema">
        {['light', 'dark', 'auto', 'custom'].map((mode) => (
          <button
            className={preferences.mode === mode ? 'active' : ''}
            key={mode}
            type="button"
            onClick={() => {
              updatePreference('mode', mode);
              if (mode === 'custom') setConfirmNotice('Ajuste as cores e confirme para aplicar.');
              if (mode !== 'custom') setConfirmNotice('');
            }}
          >
            <strong>
              {mode === 'light'
                ? 'Claro'
                : mode === 'dark'
                  ? 'Escuro'
                  : mode === 'auto'
                    ? 'Automático'
                    : 'Personalizado'}
            </strong>
            <small>
              {mode === 'light'
                ? 'Mais limpo'
                : mode === 'dark'
                  ? 'Baixa luz'
                  : mode === 'auto'
                    ? 'Segue o sistema'
                    : 'Suas cores'}
            </small>
          </button>
        ))}
      </div>

      <div className="theme-color-grid">
        {[
          ['primary', 'Cor principal', 'Base de menus'],
          ['secondary', 'Cor secundária', 'Fundos suaves'],
          ['button', 'Botões', 'Ações principais'],
          ['highlight', 'Destaques', 'Selos e avisos'],
          ['text', 'Cor da letra', 'Textos principais'],
        ].map(([key, label, hint]) => {
          const previewBackground = colorDraft[key] ?? defaultVisualPreferences[key];
          const isTextToken = key === 'text';
          const textColor = isTextToken ? previewBackground : getReadableTextColor(previewBackground);
          return (
          <label key={key}>
            <span>{label}</span>
            <small>{hint}</small>
            <strong
              className="theme-color-preview"
              style={{ '--preview-bg': isTextToken ? textPreviewBackground : previewBackground, '--preview-fg': textColor }}
            >
              {isTextToken
                ? 'Prévia do texto'
                : textColor === '#ffffff'
                  ? 'Texto claro'
                  : 'Texto escuro'}
            </strong>
            <input
              type="color"
              value={previewBackground}
              onChange={(event) => updateColorDraft(key, event.target.value)}
            />
          </label>
          );
        })}
      </div>

      <div className="theme-confirm-row">
        {confirmNotice && <small className="valid-note">{confirmNotice}</small>}
        <button type="button" onClick={confirmCustomColors}>
          Confirmar cores
        </button>
      </div>

      <div className="theme-image-controls">
        <label>
          Filtro de imagens
          <select
            value={preferences.imageFilter}
            onChange={(event) => updatePreference('imageFilter', event.target.value)}
          >
            <option value="none">Natural</option>
            <option value="grayscale">Cinza premium</option>
            <option value="warm">Quente</option>
            <option value="cool">Frio</option>
          </select>
        </label>
        <label>
          Escurecimento
          <input
            type="range"
            min="0"
            max="55"
            value={preferences.imageDim}
            onChange={(event) => updatePreference('imageDim', Number(event.target.value))}
          />
        </label>
        <label>
          Brilho
          <input
            type="range"
            min="70"
            max="115"
            value={preferences.imageBrightness}
            onChange={(event) => updatePreference('imageBrightness', Number(event.target.value))}
          />
        </label>
      </div>

      <div className="theme-contrast-preview">
        <span className="theme-token-preview" style={{ '--preview-bg': colorDraft.button, '--preview-fg': buttonText }}>Botão</span>
        <span className="theme-token-preview" style={{ '--preview-bg': colorDraft.highlight, '--preview-fg': highlightText }}>Destaque</span>
        <span className="theme-token-preview" style={{ '--preview-bg': textPreviewBackground, '--preview-fg': colorDraft.text }}>Texto</span>
      </div>
          </section>
        </div>
      )}
    </>
  );
}

// Login: identifica o tipo de conta pelo email e aceita Enter no formulario.
function LoginPanel({ loginWithEmail, setAuthMode, openPrivacyCenter }) {
  const [email, setEmail] = useState(() => getLastSignupLoginEmail());
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginNotice, setLoginNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event) {
    event?.preventDefault();
    if (isSubmitting) return;
    if (!termsAccepted) {
      setLoginNotice('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    setIsSubmitting(true);
    setLoginNotice('');
    try {
      await loginWithEmail(email, password, {
        termsAccepted,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        consentType: REQUIRED_CONSENT_TYPE,
      });
      setFailedAttempts(0);
    } catch {
      setFailedAttempts((current) => current + 1);
      setLoginNotice('Email ou senha inválidos, ou conta sem permissão ativa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLoginKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitLogin(event);
  }

  function openSignup() {
    const route = buildRouteState('profile', { signupChoice: true });
    window.history.pushState(route.historyState, '', route.url);
    setAuthMode('signup');
  }

  return (
    <form className="profile-card login-panel" onSubmit={submitLogin}>
      <span className="section-kicker">Acesso</span>
      <h3>Email e senha</h3>
      <p>Digite seu email e senha para acessar a plataforma.</p>
      <label>
        Email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={handleLoginKeyDown}
          placeholder="email"
        />
      </label>
      <label>
        Senha
        <input
          type="password"
          data-protected-password="true"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={handleLoginKeyDown}
          placeholder="Digite sua senha"
        />
      </label>
      <label className="terms-consent-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
        />
        <span>{TERMS_CONSENT_TEXT}</span>
      </label>
      <p className="policy-note">
        A plataforma usa esses dados para manter sua conta, registrar interações,
        operar feed, oportunidades, eventos, benefícios e comunicação interna.
      </p>
      <button className="privacy-inline-button light" type="button" onClick={openPrivacyCenter}>
        Termos de Uso e Privacidade
      </button>
      <div className="button-row">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
        <button className="light" type="button" onClick={openSignup}>
          Cadastrar
        </button>
      </div>
      {failedAttempts > 0 && failedAttempts < 3 && (
        <p className="invalid-note">
          Senha incorreta. Tentativa {failedAttempts} de 3.
        </p>
      )}
      {loginNotice && <p className="invalid-note">{loginNotice}</p>}
      {failedAttempts >= 3 && (
        <button className="forgot-notification" type="button" onClick={() => setAuthMode('forgot')}>
          Esqueceu senha?
        </button>
      )}
      <button className="link-button" type="button" onClick={() => setAuthMode('forgot')}>
        Esqueci a senha
      </button>
    </form>
  );
}

// Cadastro: escolha PF/PJ/Empresa, dados obrigatorios e configuracao do perfil publico.
function SignupView({ setAuthMode, loginWithEmail, openPrivacyCenter, openPage }) {
  const [segment, setSegment] = useState(() => getSignupSegmentFromUrl());
  const [signupStep, setSignupStep] = useState('basic');
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    email: '',
    phone: '',
    cpf: '',
    rg: '',
    cnpj: '',
    birthDate: '',
    companyType: 'MEI / Profissional PJ',
    tradeName: '',
    password: '',
    passwordConfirm: '',
    confirmationCode: '',
    city: '',
    state: '',
    bio: '',
    website: '',
    area: '',
    profilePhoto: '',
    coverPhoto: '',
    termsAccepted: false,
    privacyAccepted: false,
    dataProcessingAccepted: false,
  });
  const [signupNotice, setSignupNotice] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [rgVerification, setRgVerification] = useState({
    status: 'idle',
    fileName: '',
    notice: '',
  });
  const isPfSignup = segment === 'pf';
  const isPjSignup = segment === 'pj';
  const isCompanySignup = segment === 'company';
  const segmentTitle =
    segment === 'pf'
      ? 'Cadastro PF'
      : segment === 'pj'
        ? 'Cadastro PJ'
        : 'Cadastro de empresa';
  const publicName = form.displayName || form.tradeName || form.legalName || segmentTitle;
  const contactEmail = form.email.trim().toLowerCase();
  const platformAccessEmail = contactEmail;
  const showInvalidEmail = Boolean(contactEmail) && !isValidRealContactEmail(contactEmail);

  const normalizedCpf = onlyDigits(form.cpf);
  const normalizedCnpj = onlyDigits(form.cnpj);
  const rgHasAcceptedStructure = validateRg(form.rg);
  const rgIsOfficiallyVerified = rgVerification.status === 'verified';
  const rgDocumentReceived = rgVerification.status === 'pending';
  const rgIsAcceptedForSignup = rgHasAcceptedStructure && (rgIsOfficiallyVerified || rgDocumentReceived);
  const rgStatus =
    !form.rg
      ? 'RG obrigatório.'
      : !rgHasAcceptedStructure
        ? 'RG inválido.'
        : rgIsOfficiallyVerified
          ? 'RG validado oficialmente.'
          : rgVerification.status === 'checking'
            ? 'Validando RG...'
            : rgDocumentReceived
              ? 'Documento recebido. A validação manual será feita pela equipe.'
              : 'Envie o documento para validar o RG.';
  const cpfStatus =
    normalizedCpf.length === 11
      ? validateCpf(normalizedCpf)
        ? 'CPF válido'
        : 'CPF inválido.'
      : form.cpf
        ? 'CPF inválido.'
        : 'CPF obrigatório.';
  const cnpjStatus =
    normalizedCnpj.length === 14
      ? validateCnpj(normalizedCnpj)
        ? 'CNPJ válido'
        : 'CNPJ inválido'
      : 'Digite 14 números';
  const ageStatus =
    form.birthDate && isAdult(form.birthDate)
      ? 'Maior de 18 anos'
      : form.birthDate
        ? 'Cadastro permitido apenas para 18+'
        : 'Informe a data de nascimento';

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'rg') {
      setRgVerification({ status: 'idle', fileName: '', notice: '' });
    }
  }

  function updateSignupImage(field, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    update(field, URL.createObjectURL(file));
  }

  function updateSignupRoute(nextSegment) {
    const route = buildRouteState('profile', nextSegment
      ? { signupSegment: nextSegment }
      : { signupChoice: true });
    window.history.pushState(route.historyState, '', route.url);
  }

  function selectSignupSegment(nextSegment) {
    setSegment(nextSegment);
    setSignupStep('basic');
    updateSignupRoute(nextSegment);
    setTimeout(() => {
      document.querySelector('.signup-layout')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  function clearSignupSegment() {
    setSegment(null);
    setSignupStep('basic');
    updateSignupRoute(null);
  }

  function backToLogin() {
    const route = buildRouteState('profile');
    window.history.pushState(route.historyState, '', route.url);
    setAuthMode('login');
  }

  async function requestRgOfficialVerification(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateRg(form.rg)) {
      setRgVerification({
        status: 'rejected',
        fileName: file.name,
        notice: 'RG inválido.',
      });
      return;
    }

    if (!DOCUMENT_VALIDATION_ENDPOINT) {
      setRgVerification({
        status: 'pending',
        fileName: file.name,
        notice: 'Documento recebido para validação manual.',
      });
      return;
    }

    setRgVerification({
      status: 'checking',
      fileName: file.name,
      notice: 'Validando RG...',
    });

    try {
      const payload = new FormData();
      payload.append('rg', form.rg);
      payload.append('cpf', normalizedCpf);
      payload.append('legalName', form.legalName.trim());
      payload.append('document', file);

      const response = await fetch(DOCUMENT_VALIDATION_ENDPOINT, {
        method: 'POST',
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      const verified = Boolean(result.verified ?? result.ok);

      setRgVerification({
        status: verified ? 'verified' : 'rejected',
        fileName: file.name,
        notice: verified ? 'RG validado oficialmente.' : 'RG inválido.',
      });
    } catch {
      setRgVerification({
        status: 'rejected',
        fileName: file.name,
        notice: 'RG inválido.',
      });
    }
  }

  function validateBasicSignup() {
    if (!form.legalName.trim()) return 'Preencha o nome principal do cadastro.';
    if (!isValidRealContactEmail(contactEmail)) return 'Email inválido.';
    if (!platformAccessEmail) return 'Email inválido.';
    if (!form.city.trim()) return 'Informe a cidade.';
    if (!form.state.trim()) return 'Informe o estado.';
    if (form.password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      return 'A senha precisa conter letra maiúscula, letra minúscula e número.';
    }
    if (form.password !== form.passwordConfirm) return 'A confirmação da senha não confere.';
    if (!form.termsAccepted || !form.privacyAccepted || !form.dataProcessingAccepted) {
      return 'Aceite os Termos de Uso, a Política de Privacidade e o tratamento de dados LGPD para concluir o cadastro.';
    }
    if (isPfSignup && !isAdult(form.birthDate)) return 'Cadastro PF exige idade mínima de 18 anos.';
    if (isPfSignup && !validateCpf(normalizedCpf)) return 'CPF inválido.';
    if (isPfSignup && !rgHasAcceptedStructure) return 'RG inválido.';
    if (isPfSignup && !rgIsAcceptedForSignup) return 'Envie uma foto ou PDF do RG/CNH para continuar.';
    if ((isPjSignup || isCompanySignup) && !validateCnpj(normalizedCnpj)) return 'Informe um CNPJ válido.';
    return '';
  }

  async function continueToPayment(event) {
    event.preventDefault();
    if (isCreatingAccount) return;
    const validationError = validateBasicSignup();
    if (validationError) {
      setSignupNotice(validationError);
      return;
    }

    setIsCreatingAccount(true);
    setSignupNotice('');

    try {
      await registerRequest({
        name: (form.displayName || form.tradeName || form.legalName).trim(),
        email: contactEmail,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        city: form.city.trim(),
        state: form.state.trim(),
        profileImage: form.profilePhoto || undefined,
        bio: form.bio.trim() || undefined,
        acceptedTerms: form.termsAccepted,
        acceptedPrivacyPolicy: form.privacyAccepted && form.dataProcessingAccepted,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      });
      localStorage.setItem(LAST_SIGNUP_LOGIN_KEY, contactEmail);
      localStorage.setItem(LAST_SIGNUP_REQUIRES_SUBSCRIPTION_KEY, contactEmail);
      localStorage.setItem(
        LAST_SIGNUP_SEGMENT_KEY,
        segment === 'pj' ? 'teacher' : segment === 'company' ? 'company' : 'student',
      );
      await loginWithEmail(contactEmail, form.password, {
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        consentType: REQUIRED_CONSENT_TYPE,
      });
      openPage?.('subscription-checkout');
    } catch (error) {
      const message = String(error?.message ?? '');
      setSignupNotice(getSignupFailureMessage(message, error));
    } finally {
      setIsCreatingAccount(false);
    }
  }

  function getSignupFailureMessage(message, error) {
    if (message.includes('already registered')) return 'Este email já está cadastrado.';
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return 'Não foi possível conectar à API de cadastro. Verifique se o backend está ativo no cPanel e se a URL da API aponta para /meetpoint.';
    }
    if (error?.status === 404 || error?.status === 405) {
      return 'A rota de cadastro não foi encontrada no servidor. O frontend está publicado, mas a API /auth/register não respondeu nesse endereço.';
    }
    if (message.includes('password must contain')) {
      return 'A senha precisa conter letra maiúscula, letra minúscula e número.';
    }
    if (message.includes('Terms and privacy policy')) {
      return 'Aceite os Termos de Uso, a Política de Privacidade e o tratamento de dados para concluir.';
    }
    return 'Não foi possível criar o cadastro. Verifique os dados e tente novamente.';
  }

  return (
    <section>
      <button className="back-button" type="button" onClick={backToLogin}>
        Voltar
      </button>
      <PageHeader
        label="Cadastro"
        title="Criar conta"
        description="Escolha PF, PJ ou Empresa. Cada cadastro exige documentos compatíveis com o tipo de conta."
      />
      {!segment && (
        <div className="floating-modal-layer">
          <div className="floating-modal signup-choice-modal">
            <header className="modal-header-row">
              <div>
                <span className="section-kicker">Tipo de cadastro</span>
                <h3>Escolha como deseja se cadastrar</h3>
              </div>
              <button className="modal-inline-close" type="button" onClick={backToLogin}>
                Voltar ao login
              </button>
            </header>
            <div className="signup-choice-grid">
              <a
                className="method-card signup-method-link"
                href="?page=profile&signup=pf"
                onClick={(event) => {
                  event.preventDefault();
                  selectSignupSegment('pf');
                }}
              >
                <span>PF</span>
                <strong>Pessoa física</strong>
                <small>Conta pessoal para cursos, comunidades, oportunidades e benefícios.</small>
              </a>
              <a
                className="method-card signup-method-link"
                href="?page=profile&signup=pj"
                onClick={(event) => {
                  event.preventDefault();
                  selectSignupSegment('pj');
                }}
              >
                <span>PJ</span>
                <strong>Profissional ou produtor</strong>
                <small>Conta para MEI, autônomo formalizado, criador de conteúdo, mentor ou prestador.</small>
              </a>
              <a
                className="method-card signup-method-link"
                href="?page=profile&signup=empresa"
                onClick={(event) => {
                  event.preventDefault();
                  selectSignupSegment('company');
                }}
              >
                <span>Empresa</span>
                <strong>Conta corporativa</strong>
                <small>Organização com colaboradores, vagas, cursos, benefícios e gestão interna.</small>
              </a>
            </div>
          </div>
        </div>
      )}
      {segment && signupStep === 'basic' && (
        <form className="signup-layout signup-basic-layout zoom-in" onSubmit={continueToPayment}>
          <section className="profile-card">
            <span className="section-kicker">{segmentTitle}</span>
            <button className="link-button" type="button" onClick={clearSignupSegment}>
              Trocar tipo de conta
            </button>
            <label>
              {isPfSignup ? 'Nome completo' : isPjSignup ? 'Nome do profissional ou marca' : 'Razão social'}
              <input
                value={form.legalName}
                onChange={(event) => update('legalName', event.target.value)}
                placeholder={isPfSignup ? 'Nome completo' : isPjSignup ? 'Ex: Ana Lima Mentorias' : 'Ex: MeetPoint LTDA'}
              />
            </label>
            {!isPfSignup && (
              <label>
                Nome fantasia
                <input
                  value={form.tradeName}
                  onChange={(event) => update('tradeName', event.target.value)}
                  placeholder={isPjSignup ? 'Nome comercial do produtor' : 'Nome comercial da empresa'}
                />
              </label>
            )}
            <label>
              Email real para contato
              <input
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                placeholder={isCompanySignup ? 'contato@empresa.com.br' : 'seuemail@gmail.com'}
              />
            </label>
            {showInvalidEmail && (
              <p className="invalid-note">Email inválido.</p>
            )}
            <label>
              WhatsApp ou telefone
              <input
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="+55 11 99999-0000"
              />
            </label>
            <label>
              Cidade
              <input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Ex: Juazeiro"
              />
            </label>
            <label>
              Estado
              <input
                value={form.state}
                onChange={(event) => update('state', event.target.value.toUpperCase())}
                placeholder="Ex: BA"
                maxLength="2"
              />
            </label>
            {isPjSignup && (
              <>
                <label>
                  Tipo de PJ
                  <select
                    value={form.companyType}
                    onChange={(event) => update('companyType', event.target.value)}
                  >
                    <option>MEI / Profissional PJ</option>
                    <option>Produtor de conteúdo</option>
                    <option>Mentor, produtor ou profissional independente</option>
                    <option>Prestador de serviço</option>
                    <option>Parceiro comercial</option>
                  </select>
                </label>
                <p className="policy-note">
                  PJ pode vender cursos, publicar conteúdo, oferecer serviços e futuramente se vincular a uma empresa pelo perfil.
                </p>
              </>
            )}
            <label>
              Senha
              <input
                type="password"
                data-protected-password="true"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Criar senha"
              />
            </label>
            <label>
              Confirmar senha
              <input
                type="password"
                data-protected-password="true"
                autoComplete="new-password"
                value={form.passwordConfirm}
                onChange={(event) => update('passwordConfirm', event.target.value)}
                placeholder="Repetir senha"
              />
            </label>
          </section>

          <section className="profile-card yellow">
            <span className="section-kicker">Documentação</span>
            {isCompanySignup || isPjSignup ? (
              <>
                <label>
                  CNPJ
                  <input
                    value={form.cnpj}
                    onChange={(event) => update('cnpj', formatCnpj(event.target.value))}
                    placeholder="00.000.000/0001-00"
                    maxLength="18"
                  />
                </label>
                <p className={validateCnpj(normalizedCnpj) ? 'valid-note' : 'invalid-note'}>
                  {cnpjStatus}
                </p>
                <FileUpload
                  label={isPjSignup ? 'Comprovante MEI ou contrato PJ' : 'Contrato social'}
                  action={isPjSignup ? 'Enviar documento PJ' : 'Enviar contrato'}
                  accept=".pdf,image/*"
                />
                <FileUpload label="Documento do responsável" action="Enviar documento" accept=".pdf,image/*" />
                <FileUpload
                  label={isPjSignup ? 'Comprovante fiscal ou endereço' : 'Comprovante de endereço'}
                  action="Enviar comprovante"
                  accept=".pdf,image/*"
                />
              </>
            ) : (
              <>
                <label>
                  Data de nascimento
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(event) => update('birthDate', event.target.value)}
                    max={getAdultBirthDateMax()}
                  />
                </label>
                <p className={form.birthDate && isAdult(form.birthDate) ? 'valid-note' : 'invalid-note'}>
                  {ageStatus}
                </p>
                <label>
                  CPF
                  <input
                    value={form.cpf}
                    onChange={(event) => update('cpf', formatCpf(event.target.value))}
                    placeholder="000.000.000-00"
                    maxLength="14"
                  />
                </label>
                <p className={validateCpf(normalizedCpf) ? 'valid-note' : 'invalid-note'}>
                  {cpfStatus}
                </p>
                <label>
                  RG
                  <input
                    value={form.rg}
                    onChange={(event) => update('rg', formatRg(event.target.value))}
                    placeholder="00.000.000-0"
                    maxLength="12"
                  />
                </label>
                <p className={rgIsAcceptedForSignup ? 'valid-note' : 'invalid-note'}>
                  {rgStatus}
                </p>
                <FileUpload
                  label="RG ou CNH"
                  action="Validar RG"
                  accept=".pdf,image/*"
                  onChange={requestRgOfficialVerification}
                />
                <FileUpload label="Comprovante opcional" action="Enviar comprovante" accept=".pdf,image/*" />
              </>
            )}
            {isPjSignup && (
              <p className="policy-note">
                Para mexer com venda, saque, emissão de benefício ou publicação paga,
                a validação documental da PJ deve estar aprovada.
              </p>
            )}
          </section>

          <section className="profile-card blue">
            <span className="section-kicker">Confirmação</span>
            <h3>Email da conta</h3>
            <p>
              O email real será usado para login, recuperação de senha, notificações,
              vagas, eventos e cursos.
            </p>
            <div className="signup-email-summary">
              <strong>{contactEmail ? maskEmail(contactEmail) : 'Informe um email válido'}</strong>
              <small>
                A conta será criada com este email ao finalizar o cadastro. Esta tela não envia código por email.
              </small>
            </div>
            <div className="signup-privacy-consent-box">
              <strong>Termos e privacidade obrigatórios</strong>
              <p>
                Para concluir o cadastro, você precisa aceitar formalmente as regras
                da plataforma e autorizar o tratamento dos dados necessários ao uso do MeetPoint.
              </p>
              <label className="terms-consent-check">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(event) => update('termsAccepted', event.target.checked)}
                />
                <span>Li e concordo com os Termos de Uso.</span>
              </label>
              <label className="terms-consent-check">
                <input
                  type="checkbox"
                  checked={form.privacyAccepted}
                  onChange={(event) => update('privacyAccepted', event.target.checked)}
                />
                <span>Li e concordo com a Política de Privacidade.</span>
              </label>
              <label className="terms-consent-check">
                <input
                  type="checkbox"
                  checked={form.dataProcessingAccepted}
                  onChange={(event) => update('dataProcessingAccepted', event.target.checked)}
                />
                <span>{TERMS_CONSENT_TEXT}</span>
              </label>
            </div>
            <p className="policy-note">
              O aceite autoriza armazenamento e tratamento dos dados necessários para conta,
              interações, oportunidades, eventos, benefícios, comunicação interna e registros
              operacionais da plataforma.
            </p>
            <button className="privacy-inline-button light" type="button" onClick={openPrivacyCenter}>
              Termos de Uso e Privacidade
            </button>
            {signupNotice && (
              <p className={signupNotice.includes('enviado') ? 'valid-note' : 'invalid-note'}>
                {signupNotice}
              </p>
            )}
            <button type="submit" disabled={isCreatingAccount}>
              {isCreatingAccount ? 'Criando conta...' : 'Continuar para pagamento'}
            </button>
          </section>
        </form>
      )}

      {segment && signupStep === 'profile' && (
        <div className="signup-profile-setup zoom-in">
          <section className="profile-card signup-profile-preview">
            <span className="section-kicker">Perfil público</span>
            <label className="signup-cover-upload">
              <div
                className="profile-cover-band"
                style={form.coverPhoto ? { backgroundImage: `url(${form.coverPhoto})` } : undefined}
              />
              <input type="file" accept="image/*" onChange={(event) => updateSignupImage('coverPhoto', event)} />
              <span>{form.coverPhoto ? 'Trocar capa' : 'Adicionar capa'}</span>
            </label>
            <label className="signup-avatar-upload">
              <Avatar initials={getInitials(publicName)} photo={form.profilePhoto} />
              <input type="file" accept="image/*" onChange={(event) => updateSignupImage('profilePhoto', event)} />
              <span>{form.profilePhoto ? 'Trocar foto' : 'Adicionar foto'}</span>
            </label>
            <strong>{publicName}</strong>
            <small>{getAccountTypeLabel(segment)} • {form.city || 'Cidade não informada'}</small>
            <small>Email real protegido: {maskEmail(contactEmail)}</small>
          </section>

          <section className="profile-card signup-profile-form">
            <span className="section-kicker">Completar cadastro</span>
            <h3>{isCompanySignup ? 'Dados públicos da empresa' : 'Dados públicos do perfil'}</h3>
            <label>
              {isCompanySignup ? 'Nome público da empresa' : 'Nome público'}
              <input
                value={form.displayName}
                onChange={(event) => update('displayName', event.target.value)}
                placeholder={isCompanySignup ? 'Nome que aparece para clientes' : 'Nome que aparece no perfil'}
              />
            </label>
            <label>
              Cidade
              <input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Ex: Londrina"
              />
            </label>
            <label>
              Estado
              <input
                value={form.state}
                onChange={(event) => update('state', event.target.value)}
                placeholder="Ex: PR"
                maxLength="2"
              />
            </label>
            <label>
              {isCompanySignup ? 'Sobre a empresa' : 'Biografia'}
              <textarea
                value={form.bio}
                onChange={(event) => update('bio', event.target.value)}
                placeholder={isCompanySignup ? 'Resumo institucional, segmento e atuação' : 'Resumo curto sobre você, atuação e interesses'}
              />
            </label>
            <label>
              {isPfSignup ? 'Interesses principais' : 'Área, nicho ou segmento'}
              <input
                value={form.area}
                onChange={(event) => update('area', event.target.value)}
                placeholder={isPfSignup ? 'Cursos, vagas, networking...' : 'Tecnologia, marketing, saúde, educação...'}
              />
            </label>
            <label>
              Site ou rede principal
              <input
                value={form.website}
                onChange={(event) => update('website', event.target.value)}
                placeholder="https:// ou @usuario"
              />
            </label>
            <div className="button-row">
              <button className="light" type="button" onClick={() => setSignupStep('basic')}>
                Voltar aos dados
              </button>
              <button type="button" onClick={() => openPage?.('subscription-checkout')}>
                Ir para pagamento
              </button>
            </div>
            {signupNotice && <p className="invalid-note signup-submit-notice">{signupNotice}</p>}
          </section>

          <section className="profile-card signup-profile-checklist">
            <span className="section-kicker">Checklist</span>
            <h3>Antes de liberar a conta</h3>
            <p>Após criar a conta, o acesso completo só é liberado depois da escolha do plano e confirmação de pagamento.</p>
            <ul>
              <li>Email real confirmado e guardado para notificações.</li>
              <li>Documentos enviados para verificação.</li>
              <li>Perfil público com foto, capa e descrição.</li>
              <li>{isPfSignup ? 'PF aguardando assinatura para cursos, comunidades e oportunidades.' : 'PJ/Empresa aguardando assinatura e validação jurídica.'}</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

// Recuperacao de senha: alterna envio de codigo por email ou WhatsApp.
function ForgotPasswordView({ setAuthMode }) {
  const [method, setMethod] = useState('email');

  return (
    <section>
      <button className="back-button" onClick={() => setAuthMode('login')}>
        Voltar
      </button>
      <PageHeader
        label="Recuperar senha"
        title="Escolha como trocar a senha"
        description="O sistema envia um código por WhatsApp ou por email para liberar a criação de uma nova senha."
      />
      <div className="forgot-grid">
        <button
          className={method === 'email' ? 'method-card active' : 'method-card'}
          onClick={() => setMethod('email')}
        >
          <span>Email</span>
          <strong>Receber código por email</strong>
        </button>
        <button
          className={method === 'whatsapp' ? 'method-card active' : 'method-card'}
          onClick={() => setMethod('whatsapp')}
        >
          <span>WhatsApp</span>
          <strong>Receber código no celular</strong>
        </button>
        <section className="profile-card">
          <label>
            {method === 'email' ? 'Email cadastrado' : 'WhatsApp cadastrado'}
            <input placeholder={method === 'email' ? 'email@dominio.com' : '+55 11 99999-0000'} />
          </label>
          <label>Código<input placeholder="000000" /></label>
          <label>
            Nova senha
            <input
              type="password"
              data-protected-password="true"
              autoComplete="new-password"
              placeholder="Nova senha"
            />
          </label>
          <button onClick={() => setAuthMode('login')}>Trocar senha</button>
        </section>
      </div>
    </section>
  );
}

// Perfil PF: cursos inscritos, progresso, criacao de curso e documentos pessoais.
function PessoaFisicaProfile({
  enrolledCourses,
  courseProgress,
  coursePaymentStatus,
  completeLesson,
  openPage,
}) {
  const nextActions = [
    'Assistir o vídeo até o percentual mínimo definido pelo produtor.',
    'Enviar a tarefa solicitada para liberar a próxima aula.',
    'Finalizar o módulo prático para concluir o curso.',
  ];

  return (
    <section className="profile-card yellow">
      <span className="section-kicker">Pessoa Física</span>
      <p>Pessoa Física pode alterar dados pessoais, ver cursos, progresso, comunidades, candidaturas, benefícios e publicar cursos e eventos próprios.</p>
      <div className="admin-actions">
        <button type="button" onClick={() => openPage('course-create')}>
          Criar curso como PF
        </button>
        <button type="button" onClick={() => openPage('event-create')}>
          Criar evento como PF
        </button>
        <button type="button" onClick={() => openPage('courses')}>
          Ver cursos
        </button>
      </div>
      {enrolledCourses.map((course) => (
        <article className="module-card" key={course.id}>
          <strong>{course.title}</strong>
          <p>Nível: {course.level}</p>
          {!['paid', 'free'].includes(coursePaymentStatus[course.id]) && (
            <p className="invalid-note">
              Pagamento {coursePaymentStatus[course.id] === 'failed' ? 'não realizado' : 'pendente'}.
              A central foi notificada e o curso fica bloqueado até confirmação.
            </p>
          )}
          <div className="progress-bar">
            <span style={{ width: `${courseProgress[course.id] ?? 0}%` }} />
          </div>
          <p>{courseProgress[course.id] ?? 0}% concluído</p>
          <p className="policy-note">
            Próxima ação: {nextActions[Math.min(Math.floor((courseProgress[course.id] ?? 0) / 34), 2)]}
          </p>
          <button
            disabled={!['paid', 'free'].includes(coursePaymentStatus[course.id])}
            onClick={() => completeLesson(course.id)}
          >
            Validar ação e concluir aula
          </button>
        </article>
      ))}
    </section>
  );
}

// Perfil PJ: publicacao autonoma, vinculo futuro com empresa e acoes do produtor.
function PessoaJuridicaProfile({ currentUser, openPage }) {
  const [companyRequest, setCompanyRequest] = useState('');
  const [linkRequests, setLinkRequests] = useState([]);
  const linkedCompanies = currentUser.companyLinks ?? [];
  const isAutonomous = linkedCompanies.length === 0;

  function requestCompanyLink() {
    const company = companyRequest.trim();
    if (!company) return;
    setLinkRequests((current) => [
      {
        id: `link-${Date.now()}`,
        company,
        status: 'Solicitação enviada',
      },
      ...current,
    ]);
    setCompanyRequest('');
  }

  return (
    <section className="profile-card yellow">
      <span className="section-kicker">Pessoa Jurídica</span>
      <h3>{isAutonomous ? 'PJ autônoma' : 'PJ vinculada a empresa'}</h3>
      <p>
        Vínculo atual: {isAutonomous ? 'sem empresa vinculada' : linkedCompanies.join(', ')}.
        Pessoa Jurídica pode publicar cursos próprios e, quando uma empresa
        aprovar o vínculo, publicar cursos ligados a ela.
      </p>
      <div className="teacher-link-panel">
        <strong>Vincular a empresa futuramente</strong>
        <p>
          Informe a empresa que já está na plataforma. A empresa ainda precisa
          aprovar o vínculo antes de aparecer como responsável pelo curso.
        </p>
        <div className="invite-row">
          <input
            value={companyRequest}
            onChange={(event) => setCompanyRequest(event.target.value)}
            placeholder="Nome ou domínio da empresa"
          />
          <button type="button" onClick={requestCompanyLink}>Solicitar vínculo</button>
        </div>
        {linkRequests.length > 0 && (
          <div className="collaborator-list">
            {linkRequests.map((request) => (
              <article className="collaborator-row" key={request.id}>
                <span>{getInitials(request.company)}</span>
                <div>
                  <strong>{request.company}</strong>
                  <small>{request.status}</small>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLinkRequests((current) =>
                      current.filter((item) => item.id !== request.id),
                    )
                  }
                >
                  Cancelar
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="admin-actions">
        <button onClick={() => openPage('course-create')}>Publicar curso como PJ</button>
        <button onClick={() => openPage('event-create')}>Criar evento como PJ</button>
        <button>Ver aulas da empresa</button>
        <button>Finalizar cadastro PJ</button>
      </div>
    </section>
  );
}

// Perfil Empresa: dados corporativos, colaboradores, convites e cursos da empresa.
function CompanyProfile({ openPage }) {
  const [companyName, setCompanyName] = useState('MeetPoint');
  const [companyEmail, setCompanyEmail] = useState('empresa@meetpoint.com');
  const [companySearch, setCompanySearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');
  const [collaborators, setCollaborators] = useState([
    ['Marina Costa', 'Pessoa Jurídica'],
    ['Rafael Nunes', 'Coordenador'],
    ['Ana Lima', 'Administrador'],
  ]);

  const filteredCollaborators = collaborators.filter(([name, role]) => {
    const search = companySearch.trim().toLowerCase();
    return (
      !search ||
      name.toLowerCase().includes(search) ||
      role.toLowerCase().includes(search)
    );
  });

  function inviteCollaborator(role) {
    if (!inviteEmail.trim()) return;
    setCollaborators((current) => [[inviteEmail, role], ...current]);
    setInviteEmail('');
  }

  function removeCollaborator(name) {
    setCollaborators((current) =>
      current.filter(([collaboratorName]) => collaboratorName !== name),
    );
  }

  return (
    <>
      <section className="profile-card yellow company-profile-card">
        <span className="section-kicker">Perfil da empresa</span>
        <h3>Dados corporativos</h3>
        <p>Empresa altera dados corporativos, cria cursos e gerencia colaboradores.</p>
        <label>
          Nome da empresa
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        </label>
        <label>
          Email corporativo
          <input readOnly value={companyEmail} />
        </label>
        <button
          className="light"
          type="button"
          onClick={() => {
            setVerificationNotice('Troca de e-mail corporativo enviada para validação documental.');
          }}
        >
          Solicitar troca de e-mail
        </button>
        {verificationNotice && <p className="valid-note">{verificationNotice}</p>}
        <label>
          Site
          <input defaultValue="https://meetpoint.com" />
        </label>
        <label>
          Responsável legal
          <input defaultValue="Ana Lima" />
        </label>
        <FileUpload label="Logo da empresa" action="Enviar logo" accept="image/*" />
        <div className="admin-actions">
          <button type="button" onClick={() => openPage('course-create')}>
            Criar curso da empresa
          </button>
          <button type="button" onClick={() => openPage('event-create')}>
            Criar evento da empresa
          </button>
        </div>
      </section>

      <section className="profile-card blue">
        <span className="section-kicker">Documentos da empresa</span>
        <h3>CNPJ e documentos protegidos</h3>
        <p>Alterações em CNPJ/documentos exigem validação de veracidade.</p>
        <label>CNPJ<input defaultValue="12.345.678/0001-90" /></label>
        <FileUpload label="Contrato social" action="Enviar contrato" accept=".pdf,image/*" />
        <FileUpload label="Documento do responsável" action="Enviar documento" accept=".pdf,image/*" />
        <FileUpload label="Comprovante de endereço" action="Enviar comprovante" accept=".pdf,image/*" />
        <button>Solicitar verificação empresarial</button>
      </section>

      <section className="profile-card yellow company-profile-card">
        <span className="section-kicker">Colaboradores</span>
        <label>
          Buscar colaborador
          <input
            value={companySearch}
            onChange={(event) => setCompanySearch(event.target.value)}
            placeholder="Digite nome, email ou cargo"
          />
        </label>
        <label>
          Email para convite
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="pj@empresa.com"
          />
        </label>
        <div className="admin-actions">
          <button onClick={() => inviteCollaborator('Pessoa Jurídica')}>Convidar PJ</button>
          <button onClick={() => inviteCollaborator('Coordenador')}>Convidar coordenador</button>
          <button onClick={() => inviteCollaborator('Administrador')}>Convidar administrador</button>
          <button>Vincular aula a empresa</button>
        </div>
        <div className="collaborator-list">
          {filteredCollaborators.map(([name, role]) => (
            <article className="collaborator-row" key={name}>
              <span>{getInitials(name)}</span>
              <div>
                <strong>{name}</strong>
                <small>{role}</small>
              </div>
              <button onClick={() => removeCollaborator(name)}>Remover</button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

// Perfil funcionario: mostra permissoes e fila de suporte quando aplicavel.
function EmployeeProfile({ currentUser }) {
  const [activeTicket, setActiveTicket] = useState('Pessoa Física não recebeu email de compra');
  const [transferStatus, setTransferStatus] = useState('');
  const tickets = [
    ['Pessoa Física não recebeu email de compra', 'Financeiro'],
    ['Pessoa Jurídica não consegue subir vídeo', 'Suporte técnico'],
    ['Empresa quer trocar plano PJ', 'Comercial'],
  ];

  function transferTicket(sector) {
    setTransferStatus(`Ticket transferido para ${sector}.`);
  }

  return (
    <>
      <section className="profile-card yellow employee-profile-card">
        <span className="section-kicker">Área do funcionário</span>
        <h3>{currentUser.name}</h3>
        <p>Setor: {currentUser.department}. Acesso interno limitado às permissões designadas pelo admin central.</p>
        <div className="permission-chip-grid">
          {(currentUser.permissions ?? []).map((permission) => (
            <span className="permission-chip active" key={permission}>{permission}</span>
          ))}
        </div>

        {(currentUser.permissions ?? []).some((permission) => permission.toLowerCase().includes('suporte')) && (
          <section className="employee-support-panel">
            <span className="section-kicker">Fila de suporte</span>
            <label>
              Atendimento atual
              <select value={activeTicket} onChange={(event) => setActiveTicket(event.target.value)}>
                {tickets.map(([ticket]) => <option key={ticket}>{ticket}</option>)}
              </select>
            </label>
            <div className="admin-actions">
              <button onClick={() => transferTicket('Suporte técnico')}>Transferir para técnico</button>
              <button onClick={() => transferTicket('Financeiro')}>Transferir para financeiro</button>
              <button onClick={() => transferTicket('Comercial')}>Transferir para comercial</button>
            </div>
            {transferStatus && <p className="valid-note">{transferStatus}</p>}
          </section>
        )}
      </section>
      <OperationalSupportConsole mode="employee" />
    </>
  );
}

// Admin central: operacao da plataforma, suporte, funcionarios, beneficios e Pix das taxas.
function PlatformProfile({
  authToken,
  benefits,
  createBenefit,
  benefitRequests = [],
  approveBenefitRequest,
  rejectBenefitRequest,
  benefitEmailDeliveries,
}) {
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [employeeNotificationEmail, setEmployeeNotificationEmail] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState('Suporte técnico');
  const [adminSearch, setAdminSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [platformView, setPlatformView] = useState('dashboard');
  const [directoryType, setDirectoryType] = useState('companies');
  const [selectedAccountType, setSelectedAccountType] = useState('student');
  const [notice, setNotice] = useState('Painel central pronto para operar.');
  const [aiSupportEnabled, setAiSupportEnabled] = useState(true);
  const [humanQueueOpen, setHumanQueueOpen] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState('Monitoramento ativo');
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState('julia@meetpoint.com');
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    pixKeyType: 'EMAIL',
    pixKey: '',
    accountHolderName: '',
    accountDocument: '',
  });
  const [benefitDraft, setBenefitDraft] = useState({
    title: '',
    partner: '',
    category: 'Serviços',
    city: '',
    pointsCost: '',
    emailSubject: '',
    emailBody: '',
    deliveryAssetName: '',
    deliveryCode: '',
  });
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [apiStatus, setApiStatus] = useState(authToken ? 'Conectando API...' : 'Modo visual sem token de API.');
  const [dashboard, setDashboard] = useState({
    students: 0,
    companies: 0,
    teachers: 0,
    openTickets: 0,
    platformRevenueCents: 0,
    platformPayoutsCents: 0,
    platformAvailableBalanceCents: 0,
  });
  const [employees, setEmployees] = useState([]);
  const [permissions, setPermissions] = useState({
    users: true,
    companies: false,
    courses: false,
    payments: false,
    support: true,
    maintenance: false,
  });
  const permissionOptions = [
    ['users', 'Alterar usuários', 'USERS_WRITE'],
    ['companies', 'Alterar empresas', 'COMPANIES_WRITE'],
    ['courses', 'Alterar cursos', 'COURSES_WRITE'],
    ['payments', 'Ver pagamentos', 'PAYMENTS_READ'],
    ['support', 'Responder suporte', 'SUPPORT_WRITE'],
    ['maintenance', 'Manutenção técnica', 'MAINTENANCE_WRITE'],
  ];
  const permissionLabelByEnum = Object.fromEntries(
    permissionOptions.map(([, label, backend]) => [backend, label]),
  );
  const directoryData = {
    companies: [],
    students: [],
    teachers: [],
  };
  const supportTickets = [];
  const [remoteDirectory, setRemoteDirectory] = useState([]);
  const [remoteTickets, setRemoteTickets] = useState([]);
  const selectedEmployee = employees.find((employee) => employee.email === selectedEmployeeEmail) || employees[0];
  const normalizedRemoteDirectory = remoteDirectory.map((item) => ({
    id: item.id ?? item.email ?? item.name,
    name: item.name ?? item.email,
    meta:
      item.subdomain ??
      item.tenant?.name ??
      `${item._count?.enrollments ?? item._count?.users ?? 0} registros vinculados`,
    status: item.status ?? 'Ativa',
  }));
  const directorySource =
    normalizedRemoteDirectory.length > 0 ? normalizedRemoteDirectory : directoryData[directoryType];
  const filteredDirectory = directorySource.filter((item) => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return true;
    return `${item.name} ${item.meta} ${item.status}`.toLowerCase().includes(query);
  });
  const ticketSource = remoteTickets.length > 0 ? remoteTickets.map((ticket) => ({
    id: ticket.id,
    title: ticket.subject,
    owner: ticket.user?.email ?? ticket.tenant?.name ?? 'Plataforma',
    priority: ticket.priority,
  })) : supportTickets;
  const pendingBenefitRequests = benefitRequests.filter((request) => request.status === 'Pendente');

  useEffect(() => {
    if (!authToken) return;
    let ignore = false;

    async function loadAdminData() {
      try {
        const [dashboardData, staffData, ticketsData, payoutData] = await Promise.all([
          platformAdminRequest('/dashboard', authToken),
          platformAdminRequest('/staff', authToken),
          platformAdminRequest('/tickets', authToken),
          platformAdminRequest('/platform-fee-payouts', authToken),
        ]);
        if (ignore) return;
        setDashboard(dashboardData);
        setEmployees(
          staffData.length
            ? staffData.map((staff) => ({
                id: staff.id,
                name: staff.name,
                email: staff.email,
                permissions: staff.permissions.map(
                  (item) => permissionLabelByEnum[item.permission] ?? item.permission,
                ),
              }))
            : employees,
        );
        setRemoteTickets(ticketsData);
        setPayoutRequests(payoutData);
        setApiStatus('API administrativa conectada.');
      } catch {
        if (!ignore) setApiStatus('API indisponível: usando dados visuais locais.');
      }
    }

    loadAdminData();
    return () => {
      ignore = true;
    };
  }, [authToken]);

  function togglePermission(permission) {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  }

  function updatePayoutForm(field, value) {
    setPayoutForm((current) => ({ ...current, [field]: value }));
  }

  function updateBenefitDraft(field, value) {
    setBenefitDraft((current) => ({ ...current, [field]: value }));
  }

  function publishBenefit() {
    const created = createBenefit(benefitDraft);
    if (!created) {
      setNotice('Informe nome, parceiro e custo em pontos para publicar o benefício.');
      return;
    }
    setPlatformView('benefits');
    setNotice(`Benefício "${created.title}" publicado. O anexo será enviado por email quando alguém resgatar.`);
    setBenefitDraft({
      title: '',
      partner: '',
      category: 'Serviços',
      city: '',
      pointsCost: '',
      emailSubject: '',
      emailBody: '',
      deliveryAssetName: '',
      deliveryCode: '',
    });
  }

  function requestPlatformFeePayout() {
    const amountCents = Math.round(Number(payoutForm.amount || 0) * 100);
    if (amountCents <= 0 || !payoutForm.pixKey.trim() || !payoutForm.accountHolderName.trim()) {
      setNotice('Informe valor, chave Pix e titular para solicitar o envio.');
      return;
    }

    const localRequest = {
      id: `local-payout-${Date.now()}`,
      amountCents,
      pixKeyType: payoutForm.pixKeyType,
      pixKey: payoutForm.pixKey,
      accountHolderName: payoutForm.accountHolderName,
      status: 'REQUESTED',
      requestedAt: new Date().toISOString(),
    };

    setPayoutRequests((current) => [localRequest, ...current]);
    setDashboard((current) => ({
      ...current,
      platformPayoutsCents: (current.platformPayoutsCents ?? 0) + amountCents,
      platformAvailableBalanceCents: Math.max(
        (current.platformAvailableBalanceCents ?? 0) - amountCents,
        0,
      ),
    }));
    setNotice(`Solicitação Pix de ${formatCurrency(amountCents / 100)} registrada.`);
    setPayoutForm({
      amount: '',
      pixKeyType: 'EMAIL',
      pixKey: '',
      accountHolderName: '',
      accountDocument: '',
    });

    if (authToken) {
      platformAdminRequest('/platform-fee-payouts', authToken, {
        method: 'POST',
        body: JSON.stringify({
          amountCents,
          pixKeyType: payoutForm.pixKeyType,
          pixKey: payoutForm.pixKey,
          accountHolderName: payoutForm.accountHolderName,
          accountDocument: payoutForm.accountDocument || undefined,
        }),
      })
        .then((payout) => {
          setPayoutRequests((current) =>
            current.map((item) => (item.id === localRequest.id ? payout : item)),
          );
          setApiStatus('Solicitação Pix salva na API.');
        })
        .catch(() => setApiStatus('API não aceitou o Pix; solicitação mantida localmente.'));
    }
  }

  function createEmployee() {
    if (!employeeName.trim() || !employeeEmail.trim() || !employeePassword.trim()) return;
    const selectedPermissions = permissionOptions
      .filter(([permission]) => permissions[permission])
      .map(([, label]) => label);
    const backendPermissions = permissionOptions
      .filter(([permission]) => permissions[permission])
      .map(([, , backend]) => backend);
    const createdEmployee = {
      id: `local-${Date.now()}`,
      name: employeeName,
      email: employeeEmail,
      notificationEmail: employeeNotificationEmail || employeeEmail,
      department: employeeDepartment,
      temporaryPassword: employeePassword,
      permissions: selectedPermissions.length ? selectedPermissions : ['Leitura operacional'],
    };
    if (authToken) {
      platformAdminRequest('/staff', authToken, {
        method: 'POST',
        body: JSON.stringify({
          name: employeeName,
          email: employeeEmail,
          notificationEmail: employeeNotificationEmail || employeeEmail,
          temporaryPassword: employeePassword,
          department: employeeDepartment,
          role: 'SUPPORT',
          permissions: backendPermissions.length ? backendPermissions : ['SUPPORT_WRITE'],
        }),
      })
        .then((staff) => {
          setEmployees((current) =>
            current.map((employee) =>
              employee.id === createdEmployee.id
                ? {
                    id: staff.id,
                    name: staff.name,
                    email: staff.email,
                    permissions: staff.permissions.map(
                      (item) => permissionLabelByEnum[item.permission] ?? item.permission,
                    ),
                  }
                : employee,
            ),
          );
          setApiStatus('Funcionário salvo na API.');
        })
        .catch(() => setApiStatus('Não foi possível salvar na API; mantido localmente.'));
    }
    setEmployees((current) => [
      createdEmployee,
      ...current,
    ]);
    setSelectedEmployeeEmail(createdEmployee.email);
    setPlatformView('employees');
    setNotice(`Funcionário ${employeeName} criado com acesso: ${createdEmployee.permissions.join(', ')}.`);
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeePassword('');
    setEmployeeNotificationEmail('');
    setEmployeeDepartment('Suporte técnico');
  }

  function openDirectory(type) {
    setDirectoryType(type);
    setPlatformView('directory');
    setNotice(`Diretório carregado: ${type === 'companies' ? 'empresas' : type === 'students' ? 'pessoas físicas' : 'pessoas jurídicas'}.`);
    if (authToken) {
      platformAdminRequest(`/directory?type=${type}&search=${encodeURIComponent(adminSearch)}`, authToken)
        .then((items) => {
          setRemoteDirectory(items);
          setApiStatus('Diretório carregado da API.');
        })
        .catch(() => setApiStatus('Falha ao carregar diretório; mantendo dados visuais.'));
    }
  }

  function editAccount(type) {
    setSelectedAccountType(type);
    setPlatformView('account');
    setNotice(`Modo de edição aberto para ${type === 'student' ? 'Pessoa Física' : type === 'teacher' ? 'Pessoa Jurídica' : 'Empresa'}.`);
  }

  function blockAccount() {
    const target = accountSearch.trim() || 'conta selecionada';
    setPlatformView('account');
    setNotice(`${target} marcada para bloqueio preventivo. Em produção isso exigiria auditoria e motivo formal.`);
  }

  function updateEmployeePermissions() {
    if (!selectedEmployee) {
      setNotice('Crie ou selecione um funcionário antes de salvar permissões.');
      return;
    }
    const selectedPermissions = permissionOptions
      .filter(([permission]) => permissions[permission])
      .map(([, label]) => label);
    const backendPermissions = permissionOptions
      .filter(([permission]) => permissions[permission])
      .map(([, , backend]) => backend);
    setEmployees((current) =>
      current.map((employee) =>
        employee.email === selectedEmployee.email
          ? { ...employee, permissions: selectedPermissions.length ? selectedPermissions : ['Leitura operacional'] }
          : employee,
      ),
    );
    if (authToken && selectedEmployee.id && !selectedEmployee.id.startsWith('demo-') && !selectedEmployee.id.startsWith('local-')) {
      platformAdminRequest(`/staff/${selectedEmployee.id}/permissions`, authToken, {
        method: 'PATCH',
        body: JSON.stringify({
          permissions: backendPermissions.length ? backendPermissions : ['SUPPORT_WRITE'],
        }),
      })
        .then(() => setApiStatus('Permissões salvas na API.'))
        .catch(() => setApiStatus('Falha ao salvar permissões na API; alteração ficou local.'));
    }
    setNotice(`Permissões de ${selectedEmployee.name} atualizadas.`);
  }

  function selectEmployeeForPermissions(employee) {
    setSelectedEmployeeEmail(employee.email);
    setPermissions(
      Object.fromEntries(
        permissionOptions.map(([key, label]) => [key, employee.permissions.includes(label)]),
      ),
    );
    setPlatformView('employees');
    setNotice(`Editando permissões de ${employee.name}.`);
  }

  return (
    <section className="profile-card yellow platform-admin-card">
      <span className="section-kicker">Conta central da plataforma</span>
      <h3>Operação, suporte e manutenção</h3>
      <p>
        Essa conta cuida da plataforma inteira: pessoas cadastradas, empresas,
        Pessoas Físicas, Pessoas Jurídicas, suporte, manutenção e incidentes.
      </p>
      <p className="policy-note">{apiStatus}</p>

      <OperationalSupportConsole mode="platform" employees={employees} tickets={ticketSource} />

      <div className="platform-metrics">
        <article><strong>{dashboard.students}</strong><span>Pessoas Físicas</span></article>
        <article><strong>{dashboard.companies}</strong><span>Empresas</span></article>
        <article><strong>{dashboard.teachers}</strong><span>Pessoas Jurídicas</span></article>
        <article><strong>{dashboard.openTickets}</strong><span>Tickets</span></article>
        <article>
          <strong>{formatCurrency((dashboard.platformRevenueCents ?? 0) / 100)}</strong>
          <span>Taxas da plataforma</span>
        </article>
        <article>
          <strong>{formatCurrency((dashboard.platformAvailableBalanceCents ?? 0) / 100)}</strong>
          <span>Disponível Pix</span>
        </article>
      </div>

      <div className="support-grid">
        <section className="module-card">
          <strong>Suporte de IA</strong>
          <p>Responde dúvidas simples, orienta pessoas e sugere respostas para PJs e empresas.</p>
          <button
            onClick={() => {
              setPlatformView('ai');
              setNotice('Configuração de IA aberta para suporte e correção assistida.');
            }}
          >
            Configurar IA
          </button>
        </section>
        <section className="module-card">
          <strong>Suporte humano</strong>
          <p>Equipe atende problemas sensíveis, pagamento, acesso, manutenção e escalonamentos.</p>
          <button
            onClick={() => {
              setHumanQueueOpen(true);
              setPlatformView('support');
              setNotice('Fila de atendimento humano aberta.');
            }}
          >
            Abrir fila de atendimento
          </button>
        </section>
        <section className="module-card">
          <strong>Manutenção</strong>
          <p>Monitora cursos, comunidades, uploads, pagamentos e saúde geral da plataforma.</p>
          <button
            onClick={() => {
              setPlatformView('maintenance');
              setNotice('Painel técnico carregado.');
            }}
          >
            Ver painel técnico
          </button>
        </section>
        <section className="module-card">
          <strong>Pix das taxas</strong>
          <p>Envia o saldo das taxas da plataforma para uma chave Pix cadastrada.</p>
          <button
            onClick={() => {
              setPlatformView('finance');
              setNotice('Financeiro aberto para envio Pix das taxas da plataforma.');
            }}
          >
            Enviar por Pix
          </button>
        </section>
        <section className="module-card">
          <strong>Benefícios</strong>
          <p>Admin central cadastra cupons, vouchers e anexos que serão enviados por email no resgate.</p>
          <button
            onClick={() => {
              setPlatformView('benefits');
              setNotice('Cadastro e envios de benefícios abertos.');
            }}
          >
            Gerenciar benefícios
          </button>
        </section>
      </div>

      <label>
        Procurar pessoa ou empresa
        <input
          value={adminSearch}
          onChange={(event) => setAdminSearch(event.target.value)}
          placeholder="Nome, email, empresa ou documento"
        />
      </label>
      <div className="admin-actions">
        <button onClick={() => openDirectory('companies')}>Ver empresas cadastradas</button>
        <button onClick={() => openDirectory('students')}>Ver Pessoas Físicas</button>
        <button onClick={() => openDirectory('teachers')}>Ver Pessoas Jurídicas</button>
        <button
          onClick={() => {
            setHumanQueueOpen(true);
            setPlatformView('support');
            setNotice(ticketSource[0] ? `Ticket assumido: ${ticketSource[0].title}.` : 'Nenhum ticket pendente para assumir.');
          }}
        >
          Assumir ticket de suporte
        </button>
        <button
          onClick={() => {
            setPlatformView('benefits');
            setNotice('Área central de benefícios aberta.');
          }}
        >
          Cadastrar benefício
        </button>
      </div>

      <div className="platform-notice">{notice}</div>

      <section className="platform-panel zoom-in">
        <div className="platform-panel-header">
          <div>
            <span className="section-kicker">Painel operacional</span>
            <strong>
              {platformView === 'dashboard' && 'Resumo da plataforma'}
              {platformView === 'directory' && 'Diretório de contas'}
              {platformView === 'support' && 'Fila de suporte'}
              {platformView === 'ai' && 'Suporte de IA'}
              {platformView === 'maintenance' && 'Manutenção técnica'}
              {platformView === 'finance' && 'Financeiro da plataforma'}
              {platformView === 'benefits' && 'Benefícios e envios por email'}
              {platformView === 'account' && 'Edição de conta'}
              {platformView === 'employees' && 'Funcionários internos'}
            </strong>
          </div>
          <button onClick={() => setPlatformView('dashboard')}>Voltar ao resumo</button>
        </div>

        {platformView === 'dashboard' && (
          <div className="maintenance-grid">
            <article><strong>Segurança ativa</strong><span>Dados isolados por empresa e acesso protegido</span></article>
            <article><strong>Pagamentos</strong><span>Split automático: {PLATFORM_FEE_PERCENT}% para a plataforma</span></article>
            <article><strong>Suporte</strong><span>{humanQueueOpen ? 'Fila humana aberta' : 'Fila humana fechada'}</span></article>
          </div>
        )}

        {platformView === 'directory' && (
          <>
            <div className="platform-tabs">
              <button className={directoryType === 'companies' ? 'active' : ''} onClick={() => openDirectory('companies')}>Empresas</button>
              <button className={directoryType === 'students' ? 'active' : ''} onClick={() => openDirectory('students')}>Pessoas Físicas</button>
              <button className={directoryType === 'teachers' ? 'active' : ''} onClick={() => openDirectory('teachers')}>Pessoas Jurídicas</button>
            </div>
            <div className="platform-directory">
              {filteredDirectory.length === 0 ? (
                <p className="empty-state">Nenhum registro encontrado neste diretório.</p>
              ) : filteredDirectory.map((item) => (
                <article className="platform-record" key={`${directoryType}-${item.name}`}>
                  <span>{getInitials(item.name)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.meta}</small>
                  </div>
                  <button onClick={() => setNotice(`${item.name}: ${item.status}.`)}>{item.status}</button>
                </article>
              ))}
            </div>
          </>
        )}

        {platformView === 'support' && (
          <div className="support-ticket-list">
            {ticketSource.length === 0 ? (
              <p className="empty-state">Nenhum ticket de suporte aberto.</p>
            ) : ticketSource.map((ticket) => (
              <article className="platform-record" key={ticket.id ?? ticket.title}>
                <span>{ticket.priority.slice(0, 1)}</span>
                <div>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.owner}</small>
                </div>
                <button
                  onClick={() => {
                    if (authToken && ticket.id && !ticket.id.startsWith('demo-')) {
                      platformAdminRequest(`/tickets/${ticket.id}/assume`, authToken, { method: 'PATCH' })
                        .then(() => setApiStatus('Ticket assumido na API.'))
                        .catch(() => setApiStatus('Falha ao assumir ticket na API.'));
                    }
                    setNotice(`Ticket de ${ticket.owner} atribuído para a equipe central.`);
                  }}
                >
                  Assumir
                </button>
              </article>
            ))}
          </div>
        )}

        {platformView === 'ai' && (
          <div className="maintenance-grid">
            <article>
              <strong>IA de suporte</strong>
              <span>{aiSupportEnabled ? 'Ativa para respostas iniciais' : 'Pausada para revisão humana'}</span>
              <button onClick={() => setAiSupportEnabled((current) => !current)}>
                {aiSupportEnabled ? 'Pausar IA' : 'Ativar IA'}
              </button>
            </article>
            <article>
              <strong>Correção assistida</strong>
              <span>Respostas de tarefas ficam sugeridas antes de publicar nota.</span>
              <button onClick={() => setNotice('Regra aplicada: IA apenas sugere, humano aprova notas sensíveis.')}>Aplicar regra</button>
            </article>
          </div>
        )}

        {platformView === 'maintenance' && (
          <div className="maintenance-grid">
            {['Uploads', 'Pagamentos', 'Emails', 'Banco de dados'].map((item) => (
              <article key={item}>
                <strong>{item}</strong>
                <span>{maintenanceMode}</span>
                <button onClick={() => setMaintenanceMode(`${item} revisado agora`)}>Revisar</button>
              </article>
            ))}
          </div>
        )}

        {platformView === 'finance' && (
          <div className="platform-finance-panel">
            <div className="finance-grid">
              <article>
                <strong>{formatCurrency((dashboard.platformRevenueCents ?? 0) / 100)}</strong>
                <span>Taxas acumuladas</span>
              </article>
              <article>
                <strong>{formatCurrency((dashboard.platformPayoutsCents ?? 0) / 100)}</strong>
                <span>Pix solicitados/pagos</span>
              </article>
              <article>
                <strong>{formatCurrency((dashboard.platformAvailableBalanceCents ?? 0) / 100)}</strong>
                <span>Saldo disponível</span>
              </article>
            </div>

            <section className="payout-form">
              <label>
                Valor para enviar
                <input
                  type="number"
                  min="1"
                  value={payoutForm.amount}
                  onChange={(event) => updatePayoutForm('amount', event.target.value)}
                  placeholder="Ex: 500"
                />
              </label>
              <label>
                Tipo de chave Pix
                <select
                  value={payoutForm.pixKeyType}
                  onChange={(event) => updatePayoutForm('pixKeyType', event.target.value)}
                >
                  <option value="EMAIL">Email</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="PHONE">Telefone</option>
                  <option value="RANDOM">Chave aleatória</option>
                </select>
              </label>
              <label>
                Chave Pix
                <input
                  value={payoutForm.pixKey}
                  onChange={(event) => updatePayoutForm('pixKey', event.target.value)}
                  placeholder="pix@empresa.com"
                />
              </label>
              <label>
                Titular da conta
                <input
                  value={payoutForm.accountHolderName}
                  onChange={(event) => updatePayoutForm('accountHolderName', event.target.value)}
                  placeholder="Nome ou razão social"
                />
              </label>
              <label>
                CPF/CNPJ do titular
                <input
                  value={payoutForm.accountDocument}
                  onChange={(event) => updatePayoutForm('accountDocument', event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <button onClick={requestPlatformFeePayout}>Solicitar envio Pix</button>
            </section>

            <section className="payout-list">
              <span className="section-kicker">Solicitações recentes</span>
              {payoutRequests.length === 0 ? (
                <p className="empty-state">Nenhum envio Pix solicitado ainda.</p>
              ) : (
                payoutRequests.map((payout) => (
                  <article className="platform-record" key={payout.id}>
                    <span>PX</span>
                    <div>
                      <strong>{formatCurrency((payout.amountCents ?? 0) / 100)}</strong>
                      <small>{payout.accountHolderName} - {payout.pixKeyType}: {payout.pixKey}</small>
                    </div>
                    <button onClick={() => setNotice(`Pix ${payout.status}: ${formatCurrency((payout.amountCents ?? 0) / 100)}.`)}>
                      {payout.status}
                    </button>
                  </article>
                ))
              )}
            </section>
          </div>
        )}

        {platformView === 'benefits' && (
          <div className="benefit-admin-panel">
            <section className="benefit-request-admin-list">
              <span className="section-kicker">Solicitações para aprovação</span>
              <h3>Benefícios enviados por PF, PJ e empresas</h3>
              <p>
                Solicitações entram em análise e só aparecem em Benefícios depois que um administrador aprovar.
              </p>
              {pendingBenefitRequests.length === 0 ? (
                <p className="empty-state">Nenhuma solicitação pendente.</p>
              ) : (
                pendingBenefitRequests.map((request) => (
                  <article className="platform-record benefit-request-record" key={request.id}>
                    <span>{request.pointsCost}</span>
                    <div>
                      <strong>{request.title}</strong>
                      <small>{request.partner} - {request.product} - {request.category}</small>
                      <small>
                        Solicitante: {request.requesterName} ({getAccountTypeLabel(request.requesterSegment)}) - {maskEmail(request.requesterEmail)}
                      </small>
                      {request.rules && <small>Regras: {request.rules}</small>}
                    </div>
                    <div className="record-action-stack">
                      <button
                        type="button"
                        onClick={() => {
                          const approved = approveBenefitRequest?.(request.id);
                          setNotice(
                            approved
                              ? `Solicitação aprovada: ${approved.title} agora aparece em Benefícios.`
                              : 'Não foi possível aprovar essa solicitação.',
                          );
                        }}
                      >
                        Aprovar
                      </button>
                      <button
                        className="light"
                        type="button"
                        onClick={() => {
                          rejectBenefitRequest?.(request.id);
                          setNotice(`Solicitação "${request.title}" reprovada.`);
                        }}
                      >
                        Reprovar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
            <section className="benefit-admin-form">
              <span className="section-kicker">Novo benefício</span>
              <h3>Cadastrar benefício para resgate</h3>
              <p>
                O admin central define o parceiro, custo em pontos e o material
                que será enviado ao email da pessoa quando ela resgatar.
              </p>
              <div className="benefit-admin-grid">
                <label>
                  Nome do benefício
                  <input
                    value={benefitDraft.title}
                    onChange={(event) => updateBenefitDraft('title', event.target.value)}
                    placeholder="Ex: 30% OFF na mensalidade"
                  />
                </label>
                <label>
                  Parceiro
                  <input
                    value={benefitDraft.partner}
                    onChange={(event) => updateBenefitDraft('partner', event.target.value)}
                    placeholder="Nome da empresa parceira"
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={benefitDraft.category}
                    onChange={(event) => updateBenefitDraft('category', event.target.value)}
                  >
                    <option>Alimentação</option>
                    <option>Serviços</option>
                    <option>Eventos</option>
                    <option>Educação</option>
                    <option>Saúde</option>
                    <option>Networking</option>
                  </select>
                </label>
                <label>
                  Cidade
                  <input
                    value={benefitDraft.city}
                    onChange={(event) => updateBenefitDraft('city', event.target.value)}
                    placeholder="Regional, Londrina, Maringá..."
                  />
                </label>
                <label>
                  Custo em pontos
                  <input
                    type="number"
                    min="1"
                    value={benefitDraft.pointsCost}
                    onChange={(event) => updateBenefitDraft('pointsCost', event.target.value)}
                    placeholder="Ex: 150"
                  />
                </label>
                <label>
                  Código do benefício
                  <input
                    value={benefitDraft.deliveryCode}
                    onChange={(event) => updateBenefitDraft('deliveryCode', event.target.value.toUpperCase())}
                    placeholder="Ex: MP-CUPOM150"
                  />
                </label>
              </div>
              <label>
                Assunto do email
                <input
                  value={benefitDraft.emailSubject}
                  onChange={(event) => updateBenefitDraft('emailSubject', event.target.value)}
                  placeholder="Ex: Seu voucher MeetPoint"
                />
              </label>
              <label>
                Texto enviado no email
                <textarea
                  className="platform-textarea"
                  value={benefitDraft.emailBody}
                  onChange={(event) => updateBenefitDraft('emailBody', event.target.value)}
                  placeholder="Explique como usar o benefício, validade, regras e contato do parceiro."
                />
              </label>
              <FileUpload
                label="Anexo enviado por email"
                action={benefitDraft.deliveryAssetName || 'Anexar cupom, voucher ou PDF'}
                accept=".pdf,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) updateBenefitDraft('deliveryAssetName', file.name);
                }}
              />
              <button onClick={publishBenefit}>Publicar benefício</button>
            </section>

            <section className="benefit-admin-list">
              <span className="section-kicker">Benefícios publicados</span>
              {benefits.map((benefit) => (
                <article className="platform-record" key={benefit.id}>
                  <span>{benefit.pointsCost}</span>
                  <div>
                    <strong>{benefit.title}</strong>
                    <small>{benefit.partner} - {benefit.category} - {benefit.city}</small>
                    <small>Anexo: {benefit.deliveryAssetName} | Código: {benefit.deliveryCode}</small>
                  </div>
                  <button onClick={() => setNotice(`${benefit.redemptions} resgate(s) de ${benefit.title}.`)}>
                    {benefit.redemptions} resgates
                  </button>
                </article>
              ))}
            </section>

            <section className="benefit-email-log">
              <span className="section-kicker">Emails de resgate</span>
              {benefitEmailDeliveries.length === 0 ? (
                <p className="empty-state">Nenhum benefício foi resgatado ainda.</p>
              ) : (
                benefitEmailDeliveries.map((delivery) => (
                  <article className="platform-record" key={delivery.id}>
                    <span>@</span>
                    <div>
                      <strong>{delivery.benefitTitle}</strong>
                      <small>Enviado para {delivery.maskedRecipientEmail ?? maskEmail(delivery.recipientEmail)}</small>
                      <small>{delivery.assetName} | Código: {delivery.code}</small>
                    </div>
                    <button onClick={() => setNotice(`Email "${delivery.subject}" com status: ${delivery.status}.`)}>
                      {delivery.status}
                    </button>
                  </article>
                ))
              )}
            </section>
          </div>
        )}

        {platformView === 'account' && (
          <div className="account-editor">
            <label>
              Conta em análise
              <input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Nome, email ou documento"
              />
            </label>
            <div className="platform-tabs">
              <button className={selectedAccountType === 'student' ? 'active' : ''} onClick={() => editAccount('student')}>Pessoa Física</button>
              <button className={selectedAccountType === 'teacher' ? 'active' : ''} onClick={() => editAccount('teacher')}>Pessoa Jurídica</button>
              <button className={selectedAccountType === 'company' ? 'active' : ''} onClick={() => editAccount('company')}>Empresa</button>
            </div>
            <div className="admin-actions">
              <button onClick={() => setNotice('Perfil atualizado com trilha de auditoria.')}>Salvar alterações</button>
              <button onClick={blockAccount}>Bloquear conta</button>
              <button onClick={() => setNotice('Solicitação de nova verificação documental enviada.')}>Solicitar documento</button>
            </div>
          </div>
        )}

        {platformView === 'employees' && (
          selectedEmployee ? (
            <div className="employee-permission-panel">
              <article className="platform-record">
                <span>{getInitials(selectedEmployee.name)}</span>
                <div>
                  <strong>{selectedEmployee.name}</strong>
                  <small>{selectedEmployee.email}</small>
                  <small>{selectedEmployee.permissions.join(', ')}</small>
                </div>
                <button onClick={updateEmployeePermissions}>Salvar acesso</button>
              </article>
              <p>
                Selecione as permissões no card abaixo e salve. A lista do funcionário
                atualiza imediatamente para simular o controle real de acesso interno.
              </p>
            </div>
          ) : (
            <p className="empty-state">Nenhum funcionário selecionado.</p>
          )
        )}
      </section>

      <div className="platform-control-grid">
        <section className="module-card">
          <strong>Editar contas</strong>
          <p>Acesso central para alterar contas de Pessoas Físicas, Pessoas Jurídicas e Empresas.</p>
          <label>
            Buscar conta
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Nome, email ou documento"
            />
          </label>
          <div className="admin-actions">
            <button onClick={() => editAccount('student')}>Editar Pessoa Física</button>
            <button onClick={() => editAccount('teacher')}>Editar Pessoa Jurídica</button>
            <button onClick={() => editAccount('company')}>Editar empresa</button>
            <button onClick={blockAccount}>Bloquear conta</button>
          </div>
        </section>

        <section className="module-card">
          <strong>Criar funcionário interno</strong>
          <p>Funcionários da plataforma só podem ser criados pela conta central.</p>
          <label>
            Nome do funcionário
            <input
              value={employeeName}
              onChange={(event) => setEmployeeName(event.target.value)}
              placeholder="Nome completo"
            />
          </label>
          <label>
            Email corporativo
            <input
              value={employeeEmail}
              onChange={(event) => setEmployeeEmail(event.target.value)}
              placeholder="funcionário@meetpoint.com"
            />
          </label>
          <label>
            Senha temporária
            <input
              type="password"
              data-protected-password="true"
              autoComplete="new-password"
              value={employeePassword}
              onChange={(event) => setEmployeePassword(event.target.value)}
              placeholder="Senha inicial do funcionário"
            />
          </label>
          <label>
            Email para notificações
            <input
              value={employeeNotificationEmail}
              onChange={(event) => setEmployeeNotificationEmail(event.target.value)}
              placeholder="notificacoes@meetpoint.com"
            />
          </label>
          <label>
            Setor responsável
            <select
              value={employeeDepartment}
              onChange={(event) => setEmployeeDepartment(event.target.value)}
            >
              <option>Suporte técnico</option>
              <option>Financeiro</option>
              <option>Operações</option>
              <option>Comercial</option>
              <option>Manutenção</option>
            </select>
          </label>
          <button onClick={createEmployee}>Criar funcionário</button>
        </section>

        <section className="module-card">
          <strong>Permissões do funcionário</strong>
          <p>Selecione exatamente o que esse funcionário pode acessar.</p>
          <div className="permission-chip-grid">
            {permissionOptions.map(([key, label]) => (
              <label className={permissions[key] ? 'permission-chip active' : 'permission-chip'} key={key}>
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={() => togglePermission(key)}
                />
                {label}
              </label>
            ))}
          </div>
          <button onClick={updateEmployeePermissions}>Salvar permissões</button>
        </section>
      </div>

      <section className="employee-list">
        <span className="section-kicker">Funcionários internos</span>
        {employees.length === 0 ? (
          <p className="empty-state">Nenhum funcionário interno criado ainda.</p>
        ) : employees.map((employee) => (
          <article className="collaborator-row" key={employee.email}>
            <span>{getInitials(employee.name)}</span>
            <div>
              <strong>{employee.name}</strong>
              <small>{employee.email}</small>
              {employee.notificationEmail && <small>Notificações: {employee.notificationEmail}</small>}
              {employee.department && <small>Setor: {employee.department}</small>}
              <small>{employee.permissions.join(', ')}</small>
            </div>
            <button
              onClick={() => selectEmployeeForPermissions(employee)}
            >
              Editar permissões
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}

// Cabecalho padrao: garante hierarquia visual consistente entre paginas.
function PageHeader({ label, title, description, help }) {
  return (
    <header className="page-header">
      <div className="page-header-kicker">
        <span className="section-kicker">{label}</span>
        {help && <InfoTooltip text={help} />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

// Tooltip curto: esconde explicacoes de ajuda sem poluir a tela.
function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip">
      <button type="button" aria-label="Informação">i</button>
      <span role="tooltip">{text}</span>
    </span>
  );
}

// Avatar reutilizavel: exibe foto enviada ou iniciais da pessoa/empresa.
function Avatar({ initials, photo }) {
  return (
    <span className={photo ? 'avatar has-photo' : 'avatar'}>
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

// Recorte de imagem: permite ajustar zoom e posição antes de salvar foto/capa.
function ImageCropModal({ editor, onCancel, onConfirm }) {
  const canvasRef = useRef(null);
  const [imageElement, setImageElement] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImageElement(image);
    image.src = editor.sourceUrl;
  }, [editor.sourceUrl]);

  useEffect(() => {
    if (!imageElement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const outputWidth = editor.outputWidth;
    const outputHeight = editor.outputHeight;
    const baseScale = Math.max(
      outputWidth / imageElement.naturalWidth,
      outputHeight / imageElement.naturalHeight,
    );
    const scale = baseScale * zoom;
    const drawWidth = imageElement.naturalWidth * scale;
    const drawHeight = imageElement.naturalHeight * scale;
    const maxOffsetX = Math.max((drawWidth - outputWidth) / 2, 0);
    const maxOffsetY = Math.max((drawHeight - outputHeight) / 2, 0);
    const drawX = (outputWidth - drawWidth) / 2 + (offsetX / 100) * maxOffsetX;
    const drawY = (outputHeight - drawHeight) / 2 + (offsetY / 100) * maxOffsetY;

    context.clearRect(0, 0, outputWidth, outputHeight);
    context.fillStyle = '#fffaf0';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);
  }, [editor.outputHeight, editor.outputWidth, imageElement, offsetX, offsetY, zoom]);

  function confirmCrop() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL('image/jpeg', 0.92));
  }

  return createPortal(
    <div className="floating-backdrop image-crop-backdrop" onClick={onCancel}>
      <section className="floating-modal image-crop-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header-row">
          <div>
            <span className="section-kicker">{editor.kicker}</span>
            <h3>{editor.title}</h3>
            <p>{editor.description}</p>
          </div>
          <button className="light modal-inline-close" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </header>

        <div className={`crop-canvas-frame ${editor.shape}`}>
          <canvas
            ref={canvasRef}
            width={editor.outputWidth}
            height={editor.outputHeight}
            aria-label="Prévia do corte da imagem"
          />
        </div>

        <div className="crop-control-grid">
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label>
            Mover horizontal
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={offsetX}
              onChange={(event) => setOffsetX(Number(event.target.value))}
            />
          </label>
          <label>
            Mover vertical
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={offsetY}
              onChange={(event) => setOffsetY(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="button-row">
          <button type="button" onClick={confirmCrop} disabled={!imageElement}>
            Aplicar corte
          </button>
          <button className="light" type="button" onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }}>
            Centralizar
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

// Upload estilizado: oculta o input nativo e mostra um botao alinhado ao layout.
function FileUpload({ label, action, accept, onChange }) {
  const [fileName, setFileName] = useState('');

  function handleChange(event) {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? '');
    onChange?.(event);
  }

  return (
    <label className="file-upload">
      <strong className="file-upload-label">{label}</strong>
      <input type="file" accept={accept} onChange={handleChange} />
      <span className="file-upload-action">{fileName || action}</span>
    </label>
  );
}

// Menu de tres pontos: concentra acoes secundarias e fecha ao clicar fora.
function OptionsMenu({ label = 'Opções', items = [] }) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const menuRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const availableItems = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;

    function updatePanelPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const panelWidth = 230;
      const panelHeight = Math.min(
        panelRef.current?.offsetHeight ?? 320,
        window.innerHeight - 24,
      );
      const viewportGap = 12;
      const nextLeft = Math.min(
        window.innerWidth - panelWidth - viewportGap,
        Math.max(viewportGap, triggerRect.right - panelWidth),
      );
      const preferredTop = triggerRect.bottom + 8;
      const nextTop = preferredTop + panelHeight > window.innerHeight - viewportGap
        ? Math.max(viewportGap, triggerRect.top - panelHeight - 8)
        : Math.max(viewportGap, preferredTop);
      setPanelPosition({ top: nextTop, left: nextLeft });
    }

    function closeMenuOnOutsideClick(event) {
      if (menuRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    updatePanelPosition();
    document.addEventListener('pointerdown', closeMenuOnOutsideClick);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      document.removeEventListener('pointerdown', closeMenuOnOutsideClick);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open]);

  const panel = open
    ? createPortal(
        <div
          className="options-menu-panel"
          ref={panelRef}
          style={{
            top: `${panelPosition.top}px`,
            left: `${panelPosition.left}px`,
          }}
        >
          {availableItems.map((item) => (
            <button
              className={item.danger ? 'danger' : ''}
              disabled={item.disabled}
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
            >
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={open ? 'options-menu open' : 'options-menu'} ref={menuRef} onClick={(event) => event.stopPropagation()}>
      <button
        aria-expanded={open}
        aria-label={label}
        className="options-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {panel}
    </div>
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function maskEmail(email = '') {
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'email protegido';
  const visible = user.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(user.length - 1, 3))}@${domain}`;
}

function maskPhone(value = '') {
  const digits = onlyDigits(value);
  if (digits.length < 4) return 'telefone protegido';
  return `***${digits.slice(-4)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function calendarHref(event) {
  const text = encodeURIComponent(`${event.title} - ${event.type}`);
  const details = encodeURIComponent(`Evento criado na plataforma MeetPoint.`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
}

function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

function normalizeLocationName(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatRg(value) {
  return value
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .slice(0, 9)
    .replace(/^(\d{2})([0-9X])/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})([0-9X])/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})([0-9X])$/, '$1.$2.$3-$4');
}

function getAdultBirthDateMax() {
  const today = new Date();
  const adultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return adultDate.toISOString().slice(0, 10);
}

function validateCpf(cpf) {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (factor) => {
    const total = cpf
      .slice(0, factor - 1)
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * (factor - index), 0);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10]);
}

function validateRg(value) {
  const rg = value.toUpperCase().replace(/[^0-9X]/g, '');
  const digits = rg.replace(/\D/g, '');
  if (rg.length < 7 || rg.length > 9) return false;
  if (!/^\d{7,8}[\dX]?$/.test(rg)) return false;
  if (digits.length < 7 || /^(\d)\1+$/.test(digits)) return false;
  return true;
}

function validateCnpj(cnpj) {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (size) => {
    const weights =
      size === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = cnpj
      .slice(0, size)
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const result = total % 11;
    return result < 2 ? 0 : 11 - result;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

function isAdult(date) {
  const birthDate = new Date(`${date}T00:00:00`);
  const minDate = new Date(`${getAdultBirthDateMax()}T00:00:00`);
  return birthDate <= minDate;
}

createRoot(document.getElementById('root')).render(<App />);
