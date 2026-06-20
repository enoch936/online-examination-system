'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useSpring, useTransform, useMotionValue, useInView } from 'framer-motion';
import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  Monitor,
  BarChart3,
  Shield,
  Award,
  Globe,
  Users,
  CheckCircle2,
  Brain,
  Clock,
  Lock,
  Calendar,
  TrendingUp,
  Send,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Smartphone,
  Play,
  Check,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PublicNav } from '@/components/layout/public-nav';
import { Separator } from '@/components/ui/separator';
import { api } from '@/services/api';
import { toast } from 'sonner';

// Custom Animated Counter using Framer Motion
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 80,
  });
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat('en-US').format(
          Math.floor(latest)
        ) + suffix;
      }
    });
  }, [springValue, suffix]);

  return <span ref={ref} className="font-extrabold tracking-tight">0{suffix}</span>;
}

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    students: 0,
    exams: 0,
    instructors: 0,
    availability: 0,
  });

  // Spotlight pointer tracking coordinates
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ clientX, clientY, currentTarget }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // Fetch real statistics from database via our backend API
  useEffect(() => {
    api.get('/dashboard/public-stats')
      .then((res) => {
        if (res.data && res.data.data) {
          const fetched = res.data.data;
          setStats({
            students: fetched.students ?? 0,
            exams: fetched.exams ?? 0,
            instructors: fetched.instructors ?? 0,
            availability: fetched.availability ?? 99.9,
          });
        }
      })
      .catch((err) => {
        console.warn('Dashboard public stats unavailable, leaving counts at current values.', err);
      });
  }, []);

  // Scroll Progress indicator
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Features list
  const features = [
    {
      title: 'Exam Creation',
      description: 'Design exams with multi-format questions, section divisions, randomisation, and custom rules.',
      icon: BookOpen,
      color: 'from-blue-500/20 to-indigo-500/20 text-indigo-400',
    },
    {
      title: 'Secure Authentication',
      description: 'Prevent violations with multi-factor identification, browser lock security, and identity checks.',
      icon: Lock,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    },
    {
      title: 'Automatic Grading',
      description: 'Instant auto-grading for multiple-choice and short answers with customizable manual rubrics.',
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400',
    },
    {
      title: 'Real-Time Monitoring',
      description: 'Live candidate monitoring with web activity logs, tab switch detection, and violation flagging.',
      icon: Monitor,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400',
    },
    {
      title: 'Instant Results',
      description: 'Securely publish scores and generate certificates instantly upon submission or instructor audit.',
      icon: Award,
      color: 'from-rose-500/20 to-red-500/20 text-rose-400',
    },
    {
      title: 'Performance Analytics',
      description: 'Comprehensive insights, score distributions, item analysis, and difficulty grading.',
      icon: BarChart3,
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
    },
    {
      title: 'Question Bank Management',
      description: 'Centralized database of questions tags sorted by subject, course, and difficulty criteria.',
      icon: Brain,
      color: 'from-violet-500/20 to-fuchsia-500/20 text-violet-400',
    },
    {
      title: 'Remote Accessibility',
      description: 'Deliver exams globally with low bandwidth support, offline recovery, and reliable syncing.',
      icon: Globe,
      color: 'from-sky-500/20 to-blue-500/20 text-sky-400',
    },
    {
      title: 'Role-Based Access Control',
      description: 'Granular permissions configuration separating Students, Instructors, and System Administrators.',
      icon: Users,
      color: 'from-teal-500/20 to-emerald-500/20 text-teal-400',
    },
    {
      title: 'Mobile Friendly',
      description: 'Optimized interfaces designed to work smoothly on mobile layouts, tablets, and desktops.',
      icon: Smartphone,
      color: 'from-orange-500/20 to-red-500/20 text-orange-400',
    },
  ];

  // Active showcase tab for interactive CSS dashboard mockup
  const [activeTab, setActiveTab] = useState<'student' | 'instructor' | 'admin' | 'exam' | 'analytics'>('student');

  // Contact Form State
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.email || !formState.message) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      toast.success('Thank you! Your message has been received.');
      setFormState({ name: '', email: '', message: '' });
      setIsSubmitting(false);
    }, 1500);
  };

  // FAQ Accordion items
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs = [
    {
      question: 'How secure is the Online Examination System?',
      answer: 'OES is built with enterprise security at its core. It locks down candidate browsers, monitors tab-switching, registers network state logs, hashes credentials, and utilizes robust JWT tokens with rotation. Our proctoring module flags browser blurs, fullscreen exit events, and suspicious activity.'
    },
    {
      question: 'Does OES support automatic grading?',
      answer: 'Yes! Multiple-choice, multiple-select, fill-in-the-blank, and true/false questions are graded automatically. Short-answer and essay questions can be routed to instructors for manual grading with rubrics.'
    },
    {
      question: 'Can it handle high concurrent traffic?',
      answer: 'Absolutely. Built using Next.js, optimized NestJS architectures, and PostgreSQL, the platform scale supports thousands of concurrent students starting and taking exams simultaneously.'
    },
    {
      question: 'Is there mobile layout compatibility?',
      answer: 'Yes, both the student dashboard and exam interface are completely responsive and touch-friendly, allowing candidates to take exams securely from tablets or smartphones.'
    },
    {
      question: 'How do instructors set up questions and course templates?',
      answer: 'Instructors have dedicated workspaces containing question banks sorted by tags, subjects, and difficulty parameters. They can author exam templates, schedule sessions, and publish results with one click.'
    }
  ];

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="relative min-h-screen bg-neutral-950 text-neutral-100 selection:bg-primary selection:text-primary-foreground overflow-hidden">
      
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 z-50 origin-[0%]"
        style={{ scaleX }}
      />

      {/* Global Interactive Spotlight Grid & Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          className="absolute inset-0 opacity-20 transition-opacity duration-300"
          style={{
            background: useTransform(
              [mouseX, mouseY],
              ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, rgba(99, 102, 241, 0.15), transparent 80%)`
            ),
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Floating Ambient Glow Lights */}
        <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[150px] animate-pulse duration-[8s]" />
        <div className="absolute top-[40%] right-[5%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[180px] animate-pulse duration-[10s]" />
        <div className="absolute bottom-[15%] left-[10%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[130px] animate-pulse duration-[6s]" />
      </div>

      <PublicNav />

      {/* Hero Section */}
      <section id="home" className="relative z-10 pt-20 pb-24 md:pt-28 md:pb-36 lg:pt-36 lg:pb-48">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 60 }}
            className="flex flex-col items-center"
          >
            <Badge variant="outline" className="mb-6 bg-neutral-900/60 border-neutral-800/80 backdrop-blur-md px-4 py-1.5 text-xs text-indigo-400 gap-1.5 shadow-inner">
              <Sparkles className="h-3.5 w-3.5" />
              Enterprise Examination Platform
            </Badge>

            <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl leading-none">
              <span className="bg-gradient-to-b from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent block">
                Conduct Exams
              </span>
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent block">
                Anytime, Anywhere
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-base leading-8 text-neutral-300 sm:text-lg md:text-xl font-normal">
              Secure, scalable, and intelligent online examination platform for universities, schools, training centers, and corporate certification programs.
            </p>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-full px-8 py-6 text-base shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 group">
                <Link href="/register">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-neutral-700 bg-neutral-900/70 hover:bg-neutral-900/95 text-neutral-200 rounded-full px-8 py-6 text-base backdrop-blur-sm shadow-lg transition-all hover:scale-105 active:scale-95">
                <a href="#how-it-works" onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  <Play className="mr-2 h-4 w-4 fill-neutral-300 stroke-none" />
                  Watch Demo
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Interactive Floating Badges & Dashboard Mockup Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 50, delay: 0.2 }}
            className="mt-20 relative w-full max-w-5xl"
          >
            {/* Ambient Back Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-600/10 blur-3xl opacity-60 rounded-3xl -z-10" />

            {/* Dashboard Container Mockup */}
            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-2 md:p-3 backdrop-blur-xl shadow-2xl shadow-black/80">
              <div className="rounded-xl border border-neutral-800/60 bg-neutral-950/80 overflow-hidden shadow-inner">
                {/* Mock Window Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/60 border-b border-neutral-800/60">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-neutral-800" />
                    <span className="w-3 h-3 rounded-full bg-neutral-800" />
                    <span className="w-3 h-3 rounded-full bg-neutral-800" />
                  </div>
                  <div className="text-xs text-neutral-500 font-medium font-mono">oes-dashboard-preview.live</div>
                  <div className="w-12" />
                </div>
                {/* Mock Dashboard Body */}
                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                  {/* Left Mock Nav */}
                  <div className="md:col-span-1 border-r border-neutral-900/80 pr-4 hidden md:flex flex-col gap-3">
                    <div className="h-6 w-2/3 bg-neutral-900 rounded-md" />
                    <div className="space-y-2 mt-4">
                      <div className="h-5 bg-neutral-900 rounded-md flex items-center px-2"><span className="w-2 h-2 rounded-full bg-primary/80 mr-2" /><span className="h-2 w-12 bg-neutral-800 rounded" /></div>
                      <div className="h-5 bg-transparent rounded-md flex items-center px-2"><span className="w-2 h-2 rounded-full bg-neutral-800 mr-2" /><span className="h-2 w-16 bg-neutral-900 rounded" /></div>
                      <div className="h-5 bg-transparent rounded-md flex items-center px-2"><span className="w-2 h-2 rounded-full bg-neutral-800 mr-2" /><span className="h-2 w-10 bg-neutral-900 rounded" /></div>
                      <div className="h-5 bg-transparent rounded-md flex items-center px-2"><span className="w-2 h-2 rounded-full bg-neutral-800 mr-2" /><span className="h-2 w-14 bg-neutral-900 rounded" /></div>
                    </div>
                  </div>
                  {/* Right Mock Content */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-6 w-1/3 bg-neutral-900 rounded-md" />
                      <div className="h-6 w-16 bg-neutral-900 rounded-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-20 bg-neutral-900/60 border border-neutral-800/40 rounded-lg p-3 flex flex-col justify-between">
                        <div className="h-2.5 w-12 bg-neutral-800 rounded" />
                        <div className="h-5 w-8 bg-neutral-700 rounded" />
                      </div>
                      <div className="h-20 bg-neutral-900/60 border border-neutral-800/40 rounded-lg p-3 flex flex-col justify-between">
                        <div className="h-2.5 w-10 bg-neutral-800 rounded" />
                        <div className="h-5 w-6 bg-neutral-700 rounded" />
                      </div>
                      <div className="h-20 bg-neutral-900/60 border border-neutral-800/40 rounded-lg p-3 flex flex-col justify-between">
                        <div className="h-2.5 w-16 bg-neutral-800 rounded" />
                        <div className="h-5 w-10 bg-emerald-500/20 text-emerald-400 rounded flex items-center justify-center text-[10px] font-bold">99.9%</div>
                      </div>
                    </div>
                    {/* Mock Graph */}
                    <div className="h-44 bg-neutral-900/40 border border-neutral-800/40 rounded-lg p-4 flex flex-col justify-between">
                      <div className="h-3 w-1/4 bg-neutral-800 rounded" />
                      <div className="flex items-end justify-between h-28 pt-4">
                        <div className="w-[8%] h-[30%] bg-neutral-800 rounded-t" />
                        <div className="w-[8%] h-[45%] bg-neutral-800 rounded-t" />
                        <div className="w-[8%] h-[20%] bg-neutral-800 rounded-t" />
                        <div className="w-[8%] h-[60%] bg-neutral-800 rounded-t" />
                        <div className="w-[8%] h-[85%] bg-primary/70 rounded-t" />
                        <div className="w-[8%] h-[50%] bg-neutral-800 rounded-t" />
                        <div className="w-[8%] h-[90%] bg-primary rounded-t animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Floating Badges */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute -top-6 -left-6 md:-left-12 bg-neutral-900/90 border border-neutral-800 p-3 rounded-xl flex items-center gap-3 backdrop-blur shadow-xl shadow-black/40"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold">AI Proctored</div>
                <div className="text-[10px] text-neutral-500">Live monitoring active</div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 0.5 }}
              className="absolute -bottom-6 -right-6 md:-right-12 bg-neutral-900/90 border border-neutral-800 p-3 rounded-xl flex items-center gap-3 backdrop-blur shadow-xl shadow-black/40"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Check className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold">Auto Grading</div>
                <div className="text-[10px] text-neutral-500">Instant score audits</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="relative z-10 py-16 border-y border-neutral-800 bg-neutral-900/60 backdrop-blur-sm">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
            
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                <Counter value={stats.students} suffix="+" />
              </div>
              <div className="text-xs sm:text-sm font-semibold tracking-wider text-neutral-400 uppercase">Students</div>
            </div>

            <div className="space-y-2">
              <div className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                <Counter value={stats.exams} suffix="+" />
              </div>
              <div className="text-xs sm:text-sm font-semibold tracking-wider text-neutral-400 uppercase">Exams Conducted</div>
            </div>

            <div className="space-y-2">
              <div className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                <Counter value={stats.instructors} suffix="+" />
              </div>
              <div className="text-xs sm:text-sm font-semibold tracking-wider text-neutral-400 uppercase">Instructors</div>
            </div>

            <div className="space-y-2">
              <div className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                <span>99.9%</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold tracking-wider text-neutral-400 uppercase">Uptime / Availability</div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 md:py-32">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-20">
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/5 text-indigo-400 mb-4 px-3 py-1 text-xs">
              Platform Capabilities
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Built to manage the full exam lifecycle
            </h2>
            <p className="mt-4 text-neutral-400 text-base sm:text-lg">
              Discover advanced components engineered for security, scale, and detailed academic evaluation.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: idx * 0.05, type: 'spring', stiffness: 100 }}
                  whileHover={{ y: -6 }}
                  className="group relative rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 backdrop-blur transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/40 overflow-hidden"
                >
                  {/* Subtle hover internal glow */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div className={`flex h-12 h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-inner`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-neutral-100 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Screenshot Showcase Section (Tabbed CSS Previews) */}
      <section className="relative z-10 py-24 bg-neutral-950/40 border-y border-neutral-900">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/5 text-purple-400 mb-4 px-3 py-1 text-xs">
              System Interface Preview
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Experience the custom workspaces
            </h2>
            <p className="mt-4 text-neutral-400 text-base sm:text-lg">
              Explore dynamic workspaces built explicitly for students, instructors, and system administrators.
            </p>
          </div>

          {/* Interface Tabs Selector */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {[
              { id: 'student', label: 'Student Dashboard' },
              { id: 'instructor', label: 'Instructor Workspace' },
              { id: 'admin', label: 'Admin Panel' },
              { id: 'exam', label: 'Exam Delivery UI' },
              { id: 'analytics', label: 'Grade Analytics' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'text-neutral-950 font-bold bg-neutral-100 shadow-xl'
                    : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/80'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="activeTabOutline"
                    className="absolute inset-0 rounded-full bg-white -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                  />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {/* High-Fidelity Interactive CSS Mockups */}
          <div className="border border-neutral-800 bg-neutral-950/80 rounded-2xl p-4 md:p-6 shadow-2xl shadow-black/60 relative min-h-[460px] flex items-center justify-center overflow-hidden">
            
            <AnimatePresence mode="wait">
              {activeTab === 'student' && (
                <motion.div
                  key="student-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
                >
                  <div className="md:col-span-2 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">ST</div>
                      <div>
                        <h4 className="font-bold text-lg">Enoch - Student Account</h4>
                        <p className="text-xs text-neutral-500 font-medium">Undergraduate Computer Science</p>
                      </div>
                    </div>
                    
                    <div className="border border-neutral-800/60 bg-neutral-900/20 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-neutral-300">Upcoming Examination</span>
                        <Badge className="bg-amber-500/20 text-amber-400 font-bold border-none text-[10px]">SCHEDULED</Badge>
                      </div>
                      <div className="text-xl font-extrabold text-neutral-100">CS302: Database Management Systems</div>
                      <div className="flex items-center gap-6 text-xs text-neutral-400 mt-2">
                        <span className="flex items-center"><Calendar className="h-3.5 w-3.5 mr-1 text-primary" /> Today at 15:30</span>
                        <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1 text-primary" /> 90 Mins duration</span>
                      </div>
                      <Button className="w-full mt-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/10">
                        Launch Secure Examination Client
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-bold text-sm text-neutral-400 uppercase tracking-wider">Dashboard Metrics</h5>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-neutral-500 font-bold">Average Score</p>
                          <p className="text-2xl font-black mt-1 text-neutral-100">84%</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-lg" />
                      </div>
                      <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-neutral-500 font-bold">Completed Exams</p>
                          <p className="text-2xl font-black mt-1 text-neutral-100">12</p>
                        </div>
                        <Award className="h-8 w-8 text-indigo-500 bg-indigo-500/10 p-1.5 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'instructor' && (
                <motion.div
                  key="instructor-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full space-y-6 text-left"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg">CS302 Exam Template Designer</h4>
                      <p className="text-xs text-neutral-500">Subject: Relational Databases & SQL Queries</p>
                    </div>
                    <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 rounded-lg">
                      Save Draft
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 border border-neutral-900 bg-neutral-900/20 p-5 rounded-xl space-y-4">
                      <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between px-3">
                        <span className="text-sm font-semibold text-neutral-300">1. What is the default port of PostgreSQL?</span>
                        <Badge className="bg-blue-500/15 text-blue-400 border-none font-bold text-[10px]">EASY (1 Mark)</Badge>
                      </div>
                      <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between px-3">
                        <span className="text-sm font-semibold text-neutral-300">2. Explain the third normal form (3NF) requirements.</span>
                        <Badge className="bg-amber-500/15 text-amber-400 border-none font-bold text-[10px]">MEDIUM (4 Marks)</Badge>
                      </div>
                      <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between px-3">
                        <span className="text-sm font-semibold text-neutral-300">3. Write a query using nested joins to count...</span>
                        <Badge className="bg-rose-500/15 text-rose-400 border-none font-bold text-[10px]">HARD (5 Marks)</Badge>
                      </div>
                      <Button variant="outline" className="w-full border-dashed border-neutral-800 bg-transparent text-neutral-400">
                        + Add Question to Template
                      </Button>
                    </div>

                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl space-y-4">
                      <h5 className="font-bold text-sm text-neutral-300">Exam Parameters</h5>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between"><span className="text-neutral-500">Duration Limit</span><span className="font-semibold text-neutral-300">90 Mins</span></div>
                        <div className="flex justify-between"><span className="text-neutral-500">Negative Marking</span><span className="font-semibold text-neutral-300">0.25 Marks</span></div>
                        <div className="flex justify-between"><span className="text-neutral-500">Fullscreen Required</span><span className="font-semibold text-emerald-400">TRUE</span></div>
                        <div className="flex justify-between"><span className="text-neutral-500">Browser Lockdown</span><span className="font-semibold text-emerald-400">TRUE</span></div>
                      </div>
                      <Separator className="bg-neutral-850" />
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/10">
                        Publish Examination
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'admin' && (
                <motion.div
                  key="admin-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full space-y-6 text-left"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg text-neutral-100">System Monitoring & Logs</h4>
                      <p className="text-xs text-neutral-500 font-medium">Real-time coordinator dashboard</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold px-3 py-1 rounded-full text-[10px]">
                      ALL SYSTEMS OPERATIONAL
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl">
                      <p className="text-xs text-neutral-500 font-bold">Active Candidates</p>
                      <p className="text-2xl font-black text-neutral-100 mt-1">1,482</p>
                    </div>
                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl">
                      <p className="text-xs text-neutral-500 font-bold">Server Load</p>
                      <p className="text-2xl font-black text-neutral-100 mt-1">12%</p>
                    </div>
                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl">
                      <p className="text-xs text-neutral-500 font-bold">Socket Connections</p>
                      <p className="text-2xl font-black text-neutral-100 mt-1">2,891</p>
                    </div>
                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl">
                      <p className="text-xs text-neutral-500 font-bold">Active Violations</p>
                      <p className="text-2xl font-black text-rose-400 mt-1">0</p>
                    </div>
                  </div>

                  <div className="border border-neutral-900 bg-neutral-900/10 rounded-xl overflow-hidden">
                    <div className="bg-neutral-900/40 px-4 py-3 border-b border-neutral-900 text-xs font-semibold text-neutral-400 flex justify-between">
                      <span>AUDIT LOG ACTION</span>
                      <span>TIME</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs font-mono text-neutral-400">
                      <div className="flex justify-between"><span>[AUTH] User register: student-e892@uni.edu</span><span className="text-neutral-600">23:24:10</span></div>
                      <div className="flex justify-between"><span>[EXAM] Exam CS302 published by instructor-02</span><span className="text-neutral-600">23:20:05</span></div>
                      <div className="flex justify-between"><span>[SUBM] Student cs-290 submitted exam result</span><span className="text-neutral-600">23:18:41</span></div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'exam' && (
                <motion.div
                  key="exam-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full space-y-6 text-left border border-neutral-800/80 bg-neutral-950 p-5 rounded-xl"
                >
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                    <div>
                      <h4 className="font-extrabold text-base text-neutral-100">CS302 Examination Terminal</h4>
                      <p className="text-[10px] text-neutral-500 font-bold tracking-wider">CANDIDATE ID: CS-2903</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 px-3 py-1 rounded-full flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        01:14:28
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Badge className="bg-primary/20 text-indigo-400 border-none font-bold text-[9px]">QUESTION 4 OF 20</Badge>
                      <h5 className="font-bold text-sm sm:text-base text-neutral-200">
                        Which of the following database constraints ensures that all values in a column are unique?
                      </h5>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3 text-xs cursor-pointer flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full border border-neutral-700 bg-neutral-950 flex items-center justify-center text-[10px] text-neutral-400">A</span>
                        <span>NOT NULL</span>
                      </div>
                      <div className="bg-primary/10 border border-primary/50 text-indigo-200 rounded-lg p-3 text-xs cursor-pointer flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">B</span>
                        <span>UNIQUE</span>
                      </div>
                      <div className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3 text-xs cursor-pointer flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full border border-neutral-700 bg-neutral-950 flex items-center justify-center text-[10px] text-neutral-400">C</span>
                        <span>FOREIGN KEY</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-neutral-900 text-xs">
                      <Button variant="outline" size="sm" className="border-neutral-800 hover:bg-neutral-900 rounded-lg text-[11px]">
                        Previous Question
                      </Button>
                      <div className="text-neutral-500 font-bold text-[10px] tracking-wide flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-emerald-500" />
                        PROCTORING SECURE
                      </div>
                      <Button size="sm" className="bg-primary text-primary-foreground font-semibold rounded-lg text-[11px]">
                        Save & Next
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full space-y-6 text-left"
                >
                  <div>
                    <h4 className="font-bold text-lg text-neutral-100">CS302 Exam Grade Distribution</h4>
                    <p className="text-xs text-neutral-500">Instructor Report & Performance Analysis</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 h-56 border border-neutral-900 bg-neutral-900/20 rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-center text-xs text-neutral-400">
                        <span>Score Brackets (%)</span>
                        <span>Candidate Count</span>
                      </div>
                      {/* CSS-based Bar Chart */}
                      <div className="flex items-end justify-between h-36 pt-4 border-b border-neutral-900">
                        <div className="w-[12%] h-[15%] bg-neutral-800 rounded-t flex flex-col justify-end items-center"><span className="text-[9px] text-neutral-500 mb-1">5</span></div>
                        <div className="w-[12%] h-[28%] bg-neutral-800 rounded-t flex flex-col justify-end items-center"><span className="text-[9px] text-neutral-500 mb-1">12</span></div>
                        <div className="w-[12%] h-[55%] bg-indigo-500/50 rounded-t flex flex-col justify-end items-center"><span className="text-[9px] text-indigo-400 mb-1">28</span></div>
                        <div className="w-[12%] h-[88%] bg-primary rounded-t flex flex-col justify-end items-center"><span className="text-[9px] text-neutral-950 font-bold mb-1">45</span></div>
                        <div className="w-[12%] h-[40%] bg-neutral-800 rounded-t flex flex-col justify-end items-center"><span className="text-[9px] text-neutral-500 mb-1">18</span></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-500 font-bold pt-1">
                        <span>40-50</span>
                        <span>50-60</span>
                        <span>60-70</span>
                        <span>70-80</span>
                        <span>80-90</span>
                      </div>
                    </div>

                    <div className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl space-y-4 flex flex-col justify-center">
                      <div>
                        <span className="text-xs text-neutral-500 font-bold">Total Enrolled</span>
                        <h5 className="text-3xl font-black text-neutral-100 mt-1">108 Students</h5>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500 font-bold">Passing Threshold</span>
                        <h5 className="text-3xl font-black text-indigo-400 mt-1">60%</h5>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500 font-bold">Passing Candidates</span>
                        <h5 className="text-3xl font-black text-emerald-400 mt-1">88.8%</h5>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-24 md:py-32">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-20">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-400 mb-4 px-3 py-1 text-xs">
              System Flow
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Simple 5-step examination success
            </h2>
            <p className="mt-4 text-neutral-400 text-base sm:text-lg">
              Explore how students register, launch exams, receive AI grade audits, and obtain instant certifications.
            </p>
          </div>

          {/* Stepper Timeline */}
          <div className="relative border-l border-neutral-900 md:border-l-0 md:flex md:justify-between md:gap-4 max-w-5xl mx-auto pl-6 md:pl-0">
            
            {[
              { step: '01', title: 'Register / Login', desc: 'Secure student credential verification with RBAC support.' },
              { step: '02', title: 'Select Course', desc: 'Browse assigned exam sessions scheduled by course supervisors.' },
              { step: '03', title: 'Take Examination', desc: 'Deliver questions securely inside locked browser screens.' },
              { step: '04', title: 'Automatic Evaluation', desc: 'Instant calculations of points and proctoring audit trails.' },
              { step: '05', title: 'View Results', desc: 'Obtain digital scorecards and verified PDF certificates.' }
            ].map((step, idx) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.1, type: 'spring', stiffness: 85 }}
                className="relative md:flex-1 text-left pb-10 md:pb-0"
              >
                {/* Connector line for desktop */}
                {idx < 4 && (
                  <div className="hidden md:block absolute top-6 left-12 right-0 h-[2px] bg-neutral-900 -z-10" />
                )}

                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-neutral-800 bg-neutral-950 font-bold text-base text-primary shadow-lg shadow-black/85 mb-5 md:mx-0">
                  {step.step}
                </div>

                <h3 className="text-lg font-bold text-neutral-100 mb-2">
                  {step.title}
                </h3>
                
                <p className="text-sm leading-relaxed text-neutral-400 max-w-xs">
                  {step.desc}
                </p>
              </motion.div>
            ))}

          </div>

        </div>
      </section>

      {/* User Roles Section */}
      <section id="roles" className="relative z-10 py-24 md:py-32 bg-neutral-950/40 border-y border-neutral-900">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-20">
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/5 text-indigo-400 mb-4 px-3 py-1 text-xs">
              Role Permission Matrix
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Tailored workspaces for every user role
            </h2>
            <p className="mt-4 text-neutral-400 text-base sm:text-lg">
              Enjoy granular role-based permissions designed to streamline workflow operations.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            
            {/* Student Card */}
            <motion.div
              whileHover={{ y: -6 }}
              className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-8 backdrop-blur shadow-xl text-left flex flex-col justify-between"
            >
              <div>
                <Badge className="bg-primary/20 text-indigo-400 border-none font-bold text-[10px] px-2.5 py-1 mb-5">
                  ROLE: STUDENT
                </Badge>
                <h3 className="text-2xl font-bold text-neutral-100 mb-4">Take Exams & Track Scores</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                  Access examination dashboards securely, view detailed scorecards, and review previous grading remarks.
                </p>
                <Separator className="bg-neutral-900/60 mb-6" />
                <ul className="space-y-3 text-sm text-neutral-300">
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Take Examinations</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> View Results & Feedbacks</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Review Performance History</li>
                </ul>
              </div>
            </motion.div>

            {/* Instructor Card */}
            <motion.div
              whileHover={{ y: -6 }}
              className="rounded-2xl border border-primary/30 bg-neutral-900/30 p-8 backdrop-blur shadow-2xl text-left flex flex-col justify-between relative"
            >
              <div className="absolute top-4 right-4 bg-primary/20 text-indigo-300 border border-primary/35 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                Highly Recommended
              </div>
              <div>
                <Badge className="bg-purple-500/20 text-purple-400 border-none font-bold text-[10px] px-2.5 py-1 mb-5">
                  ROLE: INSTRUCTOR
                </Badge>
                <h3 className="text-2xl font-bold text-neutral-100 mb-4">Author Exams & Audit Grades</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                  Design complex templates with multiple question types, evaluate proctoring logs, and publish certifications.
                </p>
                <Separator className="bg-neutral-800/60 mb-6" />
                <ul className="space-y-3 text-sm text-neutral-300">
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Create Exam Templates</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Manage Question Banks</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Publish Results & Certificates</li>
                </ul>
              </div>
            </motion.div>

            {/* Administrator Card */}
            <motion.div
              whileHover={{ y: -6 }}
              className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-8 backdrop-blur shadow-xl text-left flex flex-col justify-between"
            >
              <div>
                <Badge className="bg-teal-500/20 text-teal-400 border-none font-bold text-[10px] px-2.5 py-1 mb-5">
                  ROLE: ADMINISTRATOR
                </Badge>
                <h3 className="text-2xl font-bold text-neutral-100 mb-4">Manage System Operations</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                  Monitor network performance, execute audit log audits, configure custom roles, and track system status.
                </p>
                <Separator className="bg-neutral-900/60 mb-6" />
                <ul className="space-y-3 text-sm text-neutral-300">
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Manage Tenant Users</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Monitor Live System Status</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary" /> Generate System Audit Reports</li>
                </ul>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* Testimonial Section */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-20">
            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-400 mb-4 px-3 py-1 text-xs">
              Client Reviews
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Trusted by leading academic institutions
            </h2>
            <p className="mt-4 text-neutral-400 text-base sm:text-lg">
              Here is what program directors and students think about the OES software suite.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            
            {[
              {
                quote: "OES has completely changed the way we host semester examinations. Browser lockdown features and auto-grading save us hundreds of administrative hours.",
                author: "Dr. Sarah Jenkins",
                role: "Director of Studies, Stanford Tech",
                initials: "SJ"
              },
              {
                quote: "Taking exams remotely felt extremely smooth. The countdown alerts and interface clean design helped me concentrate on solving questions without issues.",
                author: "Michael Chen",
                role: "Computer Science Student",
                initials: "MC"
              },
              {
                quote: "The system logs and audit trails provide unmatched security auditing. We can easily verify user transactions and tab violation events on demand.",
                author: "Marcus Aurelius",
                role: "System Coordinator, Certify Org",
                initials: "MA"
              }
            ].map((t, idx) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="bg-neutral-900/30 border border-neutral-900 p-6 rounded-2xl flex flex-col justify-between text-left backdrop-blur-md hover:border-neutral-800 transition-colors"
              >
                <p className="text-sm leading-relaxed text-neutral-300 italic mb-6">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow shadow-indigo-500/25">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-100">{t.author}</div>
                    <div className="text-[11px] text-neutral-500 font-medium">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}

          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-24 md:py-32 bg-neutral-950/40 border-t border-neutral-900">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/5 text-indigo-400 mb-4 px-3 py-1 text-xs">
              Common Questions
            </Badge>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Frequently Asked Questions
            </h2>
          </div>

          <Accordion type="single" collapsible className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="border border-neutral-900 rounded-xl overflow-hidden bg-neutral-950/60 backdrop-blur-sm transition-all duration-300 hover:border-neutral-800/80"
              >
                <AccordionTrigger className="px-5 py-4 text-left font-bold text-sm sm:text-base text-neutral-200 hover:text-neutral-100">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="p-5 pt-0 text-sm leading-relaxed text-neutral-400 border-t border-neutral-900 bg-neutral-950/30">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 py-24 md:py-32">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
          
          <div className="grid gap-12 lg:grid-cols-5 max-w-5xl mx-auto">
            
            <div className="lg:col-span-2 text-left space-y-6">
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-400 px-3 py-1 text-xs">
                Get In Touch
              </Badge>
              <h2 className="text-3xl font-extrabold sm:text-4xl md:text-5xl bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
                Contact sales or request demo
              </h2>
              <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                Interested in testing our examination system with your academic organization? Drop us a line and our system coordinators will respond within 24 hours.
              </p>

              <div className="space-y-4 text-sm text-neutral-350">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <span>support@oes-platform.live</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span>+1 (800) OES-EXAM</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Academic Square, Cambridge, MA</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <form onSubmit={handleContactSubmit} className="bg-neutral-905 border border-neutral-900 p-6 sm:p-8 rounded-2xl backdrop-blur-md space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Your Name</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Enoch"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="enoch@platform.live"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label htmlFor="message" className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Message Description</label>
                  <textarea
                    id="message"
                    rows={4}
                    placeholder="Hello, I would like to request academic trial configurations for 200 concurrent student seats..."
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground font-bold py-5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/10 hover:bg-primary/90 transition-all">
                  {isSubmitting ? 'Sending Request...' : 'Send Message'}
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>

          </div>

        </div>
      </section>

      <Separator className="bg-neutral-900" />

      {/* Footer */}
      <footer className="relative z-10 py-12 md:py-16 bg-neutral-950">
        <div className="container px-4 sm:px-6 lg:px-8 mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 text-left">
          
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xl text-neutral-100">
              <GraduationCap className="h-6 w-6 text-primary" />
              OES
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
              Conduct secure, scalable, and intelligent academic online examinations globally.
            </p>
          </div>

          <div className="space-y-3">
            <h6 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Product</h6>
            <ul className="space-y-2 text-xs text-neutral-500">
              <li><Link href="/register" className="hover:text-primary transition-colors">Exams Scheduler</Link></li>
              <li><Link href="/register" className="hover:text-primary transition-colors">AI Proctoring</Link></li>
              <li><Link href="/register" className="hover:text-primary transition-colors">Grading Rubrics</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h6 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Resources</h6>
            <ul className="space-y-2 text-xs text-neutral-500">
              <li><a href="#faq" className="hover:text-primary transition-colors">FAQ & Support</a></li>
              <li><a href="#how-it-works" className="hover:text-primary transition-colors">Platform flow</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">SaaS Features</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h6 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Institution</h6>
            <ul className="space-y-2 text-xs text-neutral-500">
              <li><a href="#contact" className="hover:text-primary transition-colors">Contact Sales</a></li>
              <li><Link href="/login" className="hover:text-primary transition-colors">Student Log-In</Link></li>
              <li><Link href="/register" className="hover:text-primary transition-colors">Create Account</Link></li>
            </ul>
          </div>

        </div>

        <div className="container px-4 sm:px-6 lg:px-8 mx-auto flex flex-col items-center justify-between gap-4 md:flex-row border-t border-neutral-900 pt-8 text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            &copy; {new Date().getFullYear()} OES Platform. All rights reserved.
          </div>
          <div className="flex gap-4">
            <span className="hover:text-neutral-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-neutral-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
