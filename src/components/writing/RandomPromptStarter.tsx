'use client';

import React, { useState } from 'react';

interface Props {
  genre?: string;
  outlineSections?: string[];
}

const GENERAL_PROMPTS = [
  'Write the scene you keep avoiding.',
  'Start in the middle of an argument.',
  'Describe a room through the eyes of someone who just received terrible news.',
  'Write a paragraph where every sentence starts with a different letter.',
  'What does your character smell right now?',
  'Write the worst possible opening line. Now make it good.',
  'Pick two characters. They disagree about something trivial.',
  'Write a scene that takes place entirely in a moving vehicle.',
  'Describe a memory your character wishes they could forget.',
  'Write dialogue where one person is lying and the other knows it.',
  'Start with a sound. What made it?',
  'Your character finds something in their pocket they don\'t remember putting there.',
  'Write a scene where nothing happens but everything changes.',
  'Describe the exact moment someone decides to leave.',
  'Write a paragraph using only short sentences. Under ten words each.',
];

const FICTION_PROMPTS = [
  'Write the scene you\'d read to a friend to make them want to read the whole book.',
  'Your protagonist just did something completely out of character. Why?',
  'Write the confrontation your characters have been building toward.',
  'Describe your setting at the worst possible time of day.',
  'A secondary character takes over the scene. What do they notice?',
  'Write the last paragraph of a chapter that makes someone turn the page.',
  'Two characters meet for the first time. One of them is wrong about something.',
  'Rewrite your last scene from a different point of view.',
];

const NONFICTION_PROMPTS = [
  'What\'s the one thing your reader needs to understand before anything else?',
  'Write the paragraph that explains why this topic matters right now.',
  'Find the story inside your argument. Tell it.',
  'Write as if explaining this to a smart friend over coffee.',
  'What\'s the strongest counterargument? Address it head-on.',
  'Start with a specific, concrete example before going broad.',
  'Write the sentence that captures your entire thesis.',
  'What surprised you most in your research? Start there.',
];

const POETRY_PROMPTS = [
  'Write five lines about an ordinary object. Make it extraordinary.',
  'Use the structure of a recipe to write about something that isn\'t food.',
  'Write a poem that fits inside a text message.',
  'Start with a colour. End with a sound.',
  'Write about distance without mentioning miles or kilometres.',
];

function getPromptsForGenre(genre: string): string[] {
  const g = genre.toLowerCase();
  if (g.includes('fiction') || g.includes('novel') || g.includes('story') || g.includes('fantasy') || g.includes('sci-fi') || g.includes('thriller') || g.includes('romance')) {
    return [...GENERAL_PROMPTS, ...FICTION_PROMPTS];
  }
  if (g.includes('essay') || g.includes('nonfiction') || g.includes('non-fiction') || g.includes('article') || g.includes('academic') || g.includes('blog')) {
    return [...GENERAL_PROMPTS, ...NONFICTION_PROMPTS];
  }
  if (g.includes('poetry') || g.includes('poem')) {
    return [...GENERAL_PROMPTS, ...POETRY_PROMPTS];
  }
  return GENERAL_PROMPTS;
}

export default function RandomPromptStarter({ genre, outlineSections }: Props) {
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  const prompts = getPromptsForGenre(genre || '');

  const getRandomPrompt = () => {
    let available = prompts.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (available.length === 0) {
      setUsedIndices(new Set());
      available = prompts.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    setUsedIndices(prev => new Set([...prev, idx]));
    setCurrentPrompt(prompts[idx]);
  };

  const getRandomSection = () => {
    if (!outlineSections || outlineSections.length === 0) return;
    const section = outlineSections[Math.floor(Math.random() * outlineSections.length)];
    setCurrentPrompt(`Work on: "${section}" — just get something on the page for this section.`);
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 14 }}>Prompt Starter</h3>

      {currentPrompt ? (
        <div style={{
          padding: '16px 20px', background: 'var(--bg-input)',
          borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-amber)',
          marginBottom: 14, fontSize: 14, lineHeight: 1.6, fontStyle: 'italic',
        }}>
          {currentPrompt}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
          Stuck? Grab a random prompt to get the words flowing.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={getRandomPrompt} style={{ fontSize: 13 }}>
          {currentPrompt ? 'Another Prompt' : 'Get a Prompt'}
        </button>
        {outlineSections && outlineSections.length > 0 && (
          <button className="btn-ghost" onClick={getRandomSection} style={{ fontSize: 13 }}>
            Random Section
          </button>
        )}
      </div>
    </div>
  );
}
