import { useState, useEffect, useRef } from 'react';

interface ScrollSpyResult {
  activeSection: string;
  registerSection: (id: string, element: HTMLElement) => void;
}

export const useScrollSpy = (sectionIds: string[], options?: IntersectionObserverInit): ScrollSpyResult => {
  const [activeSection, setActiveSection] = useState(sectionIds[0] || '');
  const observer = useRef<IntersectionObserver | null>(null);
  const sectionElements = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (observer.current) {
      observer.current.disconnect();
    }

    const intersectionOptions: IntersectionObserverInit = {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0.1,
      ...options
    };

    observer.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, intersectionOptions);

    // Registrar todas as seções
    sectionIds.forEach((id) => {
      const element = sectionElements.current.get(id);
      if (element && observer.current) {
        observer.current.observe(element);
      }
    });

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [sectionIds, options]);

  const registerSection = (id: string, element: HTMLElement) => {
    sectionElements.current.set(id, element);
    if (observer.current) {
      observer.current.observe(element);
    }
  };

  return { activeSection, registerSection };
};