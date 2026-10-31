import React, { useState, useMemo } from 'react';
import { ResourceLink, ResourceCategory, Course, INITIAL_RESOURCE_LINKS } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Bookmark,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit2,
  Globe,
  BookOpen,
  Library,
  Calendar,
  Cloud,
  Wrench,
  Link as LinkIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';

interface ResourceLinkerSectionProps {
  resources?: ResourceLink[];
  courses?: Course[];
  onUpdateResources?: (resources: ResourceLink[]) => void;
  className?: string;
}

const CATEGORIES: { label: ResourceCategory; icon: any; colorClass: string; bgClass: string }[] = [
  {
    label: 'Portal',
    icon: Globe,
    colorClass: 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    bgClass: 'bg-blue-50 dark:bg-blue-950/60',
  },
  {
    label: 'Course Material',
    icon: BookOpen,
    colorClass: 'text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/60',
  },
  {
    label: 'Library',
    icon: Library,
    colorClass: 'text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    bgClass: 'bg-amber-50 dark:bg-amber-950/60',
  },
  {
    label: 'Schedule',
    icon: Calendar,
    colorClass: 'text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/60',
  },
  {
    label: 'Drive',
    icon: Cloud,
    colorClass: 'text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    bgClass: 'bg-cyan-50 dark:bg-cyan-950/60',
  },
  {
    label: 'Tools',
    icon: Wrench,
    colorClass: 'text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    bgClass: 'bg-purple-50 dark:bg-purple-950/60',
  },
  {
    label: 'Other',
    icon: LinkIcon,
    colorClass: 'text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    bgClass: 'bg-zinc-100 dark:bg-zinc-800',
  },
];

export const ResourceLinkerSection: React.FC<ResourceLinkerSectionProps> = ({
  resources: controlledResources,
  courses = [],
  onUpdateResources,
  className = '',
}) => {
  // Local state with localStorage persistence if not fully controlled
  const [internalResources, setInternalResources] = useState<ResourceLink[]>(() => {
    try {
      const saved = localStorage.getItem('unisphere_resource_links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (r: ResourceLink) =>
              !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
              !r.url?.includes('unirand.it')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('unisphere_resource_links', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {}
    return INITIAL_RESOURCE_LINKS;
  });

  const resources = controlledResources || internalResources;

  const persistResources = (newLinks: ResourceLink[]) => {
    setInternalResources(newLinks);
    try {
      localStorage.setItem('unisphere_resource_links', JSON.stringify(newLinks));
    } catch {}
    if (onUpdateResources) {
      onUpdateResources(newLinks);
    }
  };

  // UI state
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState<ResourceCategory>('Portal');
  const [formCourseName, setFormCourseName] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Filtered resources
  const filteredResources = useMemo(() => {
    let result = [...resources];

    // Filter by Category
    if (activeCategory !== 'all') {
      result = result.filter((r) => r.category === activeCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          (r.courseName && r.courseName.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    // Sort: Pinned first, then newest
    return result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [resources, activeCategory, searchQuery]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormUrl('');
    setFormCategory('Portal');
    setFormCourseName(courses[0]?.title || '');
    setFormNotes('');
    setFormIsPinned(false);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (res: ResourceLink) => {
    setEditingId(res.id);
    setFormTitle(res.title);
    setFormUrl(res.url);
    setFormCategory(res.category);
    setFormCourseName(res.courseName || '');
    setFormNotes(res.notes || '');
    setFormIsPinned(!!res.isPinned);
    setIsModalOpen(true);
  };

  // Save Link
  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    let cleanUrl = formUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (editingId) {
      // Update existing
      const updated = resources.map((r) =>
        r.id === editingId
          ? {
              ...r,
              title: formTitle.trim(),
              url: cleanUrl,
              category: formCategory,
              courseName: formCourseName ? formCourseName : undefined,
              notes: formNotes.trim() || undefined,
              isPinned: formIsPinned,
            }
          : r
      );
      persistResources(updated);
    } else {
      // Create new
      const newLink: ResourceLink = {
        id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: formTitle.trim(),
        url: cleanUrl,
        category: formCategory,
        courseName: formCourseName ? formCourseName : undefined,
        notes: formNotes.trim() || undefined,
        isPinned: formIsPinned,
        createdAt: Date.now(),
      };
      persistResources([newLink, ...resources]);
    }

    setIsModalOpen(false);
  };

  // Delete Link
  const handleDeleteLink = (id: string) => {
    const updated = resources.filter((r) => r.id !== id);
    persistResources(updated);
  };

  // Toggle Pin
  const handleTogglePin = (id: string) => {
    const updated = resources.map((r) =>
      r.id === id ? { ...r, isPinned: !r.isPinned } : r
    );
    persistResources(updated);
  };

  // Copy Link
  const handleCopyLink = (res: ResourceLink) => {
    navigator.clipboard.writeText(res.url);
    setCopiedId(res.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === res.id ? null : curr));
    }, 2000);
  };


  // Helper for clean domain display
  const getDomain = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0];
    }
  };

  const getCategoryConfig = (cat: ResourceCategory) => {
    return CATEGORIES.find((c) => c.label === cat) || CATEGORIES[0];
  };

  return (
    <div
      className={`border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md slite-shadow overflow-hidden flex flex-col flex-1 min-h-0 h-full relative transition-colors ${className}`}
    >
      {/* Widget Header with title matching Slite warm style: Resource Linker */}
      <div className="shrink-0 bg-[#fdf9f4] dark:bg-zinc-900/90 border-b border-[#ecedef] dark:border-zinc-800 px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-[#2d2f34] dark:text-zinc-100">
          <Bookmark size={15} className="text-[#6366F1]" />
          <span>Resource Linker</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#f9efe4] dark:bg-zinc-800 text-[#3f434a] dark:text-zinc-400 border border-[#ecedef] dark:border-zinc-700">
            {resources.length}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleOpenCreate}
          className="h-7 px-2.5 text-[11px] font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md flex items-center gap-1 cursor-pointer transition-all shadow-xs"
        >
          <Plus size={13} />
          <span>Add Bookmark</span>
        </Button>
      </div>

      <div className="p-3 text-xs flex flex-col flex-1 min-h-0 space-y-2.5">
        {/* Search & Category Filter Bar */}
        <div className="shrink-0 space-y-2">
          {/* Search Bar */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3f434a]/60 dark:text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search portal links, course slides, OPAC..."
              className="w-full text-[11px] py-1.5 pl-7 pr-3 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4] dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 transition-all placeholder:text-[#3f434a]/60 dark:placeholder:text-zinc-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
              }}
              className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-all shrink-0 cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#6366F1] text-white font-semibold'
                  : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#3f434a] dark:text-zinc-300 hover:bg-[#f3e3d3] dark:hover:bg-zinc-700'
              }`}
            >
              All ({resources.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = resources.filter((r) => r.category === cat.label).length;
              if (count === 0 && activeCategory !== cat.label) return null;
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.label);
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                    activeCategory === cat.label
                      ? 'bg-[#6366F1] text-white font-semibold'
                      : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#3f434a] dark:text-zinc-300 hover:bg-[#f3e3d3] dark:hover:bg-zinc-700'
                  }`}
                >
                  <IconComp size={10} />
                  <span>{cat.label}</span>
                  <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bookmarks List Container */}
        <div className="flex-1 min-h-[160px] overflow-y-auto space-y-2 pr-0.5">
          {filteredResources.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 text-[11px] space-y-2">
              <Bookmark size={24} className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="font-semibold text-[#2d2f34] dark:text-zinc-200">
                {searchQuery ? 'No bookmarks match your search.' : 'No bookmarked resources yet.'}
              </p>
              <p className="text-[10px] text-[#3f434a]/80 dark:text-zinc-400 max-w-xs mx-auto">
                Save your university secretariat portal, Moodle course syllabus, and lecture drive folders for quick one-click access.
              </p>

              {/* Action Button for adding first bookmark */}
              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenCreate}
                  className="h-7 px-3 text-[11px] font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={13} />
                  <span>Add First Bookmark</span>
                </Button>
              </div>
            </div>
          ) : (
            filteredResources.map((res) => {
              const catCfg = getCategoryConfig(res.category);
              const IconComp = catCfg.icon;
              const isCopied = copiedId === res.id;

              return (
                <div
                  key={res.id}
                  className={`p-2.5 rounded-md border transition-all duration-150 relative group ${
                    res.isPinned
                      ? 'bg-[#fdfbf7] dark:bg-zinc-900 border-[#6366F1]/30 dark:border-[#6366F1]/40 shadow-xs'
                      : 'bg-[#fdf9f4] dark:bg-zinc-950 border-[#ecedef] dark:border-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Category Icon, Title, and Domain */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {res.isPinned && (
                          <span
                            className="inline-flex items-center text-[#6366F1] shrink-0"
                            title="Pinned to top"
                          >
                            <Pin size={11} className="fill-[#6366F1]" />
                          </span>
                        )}

                        <Badge
                          variant="secondary"
                          className={`text-[9px] py-0 px-1.5 font-semibold rounded-md border flex items-center gap-1 ${catCfg.colorClass} ${catCfg.bgClass}`}
                        >
                          <IconComp size={9} />
                          <span>{res.category}</span>
                        </Badge>

                        {res.courseName && (
                          <span className="text-[9.5px] font-medium font-sans text-neutral-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 px-1.5 py-0.2 rounded-md truncate max-w-[130px]">
                            {res.courseName}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[12px] text-[#2d2f34] dark:text-zinc-100 hover:text-[#6366F1] dark:hover:text-indigo-400 transition-colors flex items-center gap-1 group-hover:underline"
                        title={`Open ${res.url}`}
                      >
                        <span className="truncate">{res.title}</span>
                        <ExternalLink size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
                      </a>

                      {/* Domain pill */}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#3f434a]/80 dark:text-zinc-400">
                        <span className="truncate">{getDomain(res.url)}</span>
                      </div>

                      {/* Optional notes */}
                      {res.notes && (
                        <p className="text-[10px] text-[#3f434a] dark:text-zinc-400 leading-snug line-clamp-2 pt-0.5">
                          {res.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {/* Open Link Button */}
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-6 px-2 text-[10px] font-medium rounded-md bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="Open portal in new tab"
                      >
                        <ExternalLink size={10} />
                        <span className="hidden sm:inline">Open</span>
                      </a>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(res)}
                        className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-white dark:bg-zinc-900 border-[#ecedef] dark:border-zinc-800 text-[#3f434a] dark:text-zinc-300 hover:bg-[#f9efe4] dark:hover:bg-zinc-800'
                        }`}
                        title={isCopied ? 'URL Copied!' : 'Copy Link URL'}
                      >
                        {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      </button>

                      {/* Pin Button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePin(res.id)}
                        className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          res.isPinned
                            ? 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/30'
                            : 'bg-white dark:bg-zinc-900 border-[#ecedef] dark:border-zinc-800 text-[#3f434a]/60 dark:text-zinc-500 hover:text-[#6366F1] hover:bg-[#f9efe4] dark:hover:bg-zinc-800'
                        }`}
                        title={res.isPinned ? 'Unpin bookmark' : 'Pin bookmark to top'}
                      >
                        <Pin size={11} className={res.isPinned ? 'fill-[#6366F1]' : ''} />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(res)}
                        className="h-6 w-6 rounded-md border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#3f434a] dark:text-zinc-300 hover:bg-[#f9efe4] dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit bookmark"
                      >
                        <Edit2 size={11} />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(res.id)}
                        className="h-6 w-6 rounded-md border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900 flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete bookmark"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ADD / EDIT BOOKMARK MODAL */}
      {isModalOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsModalOpen(false); }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col text-xs overflow-hidden bg-white dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 rounded-md slite-shadow">
            <DialogHeader className="border-b border-[#ecedef] dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark size={16} className="text-[#6366F1]" />
                <DialogTitle className="text-sm font-semibold text-[#2d2f34] dark:text-zinc-100">
                  {editingId ? 'Edit Resource Link' : 'Add University Resource Link'}
                </DialogTitle>
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-[#3f434a] hover:text-[#2d2f34] dark:hover:text-zinc-200 rounded-md"
                >
                  ✕
                </Button>
              </DialogClose>
            </DialogHeader>

            <form onSubmit={handleSaveLink} className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200 block mb-1">
                  Title <span className="text-[#6366F1]">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Student Secretariat Portal"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="text-xs rounded-md"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200 block mb-1">
                  URL / Portal Link <span className="text-[#6366F1]">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. https://portal.uni.edu or drive.google.com"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="text-xs font-mono rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200 block mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ResourceCategory)}
                    className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="Portal">University Portal</option>
                    <option value="Course Material">Course Material / Slides</option>
                    <option value="Library">Library &amp; OPAC</option>
                    <option value="Schedule">Schedule &amp; Timetable</option>
                    <option value="Drive">Cloud Drive / Folder</option>
                    <option value="Tools">Academic Tools</option>
                    <option value="Other">Other Resource</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200 block mb-1">
                    Associated Course (optional)
                  </label>
                  <select
                    value={formCourseName}
                    onChange={(e) => setFormCourseName(e.target.value)}
                    className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="">General (None)</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200 block mb-1">
                  Notes or Login Tips (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Use institutional SPID credentials, enrollment code: MATH2026"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-[#6366F1] resize-none font-sans"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-[#2d2f34] dark:text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="rounded-md border-gray-300 dark:border-zinc-700 text-[#6366F1] focus:ring-0"
                  />
                  <span>Pin this resource to the top</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#ecedef] dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md font-semibold"
                >
                  {editingId ? 'Update Bookmark' : 'Save Bookmark'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
