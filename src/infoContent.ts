export const INFO_CONTENT = {
  version: '1.1.0',
  publisher: 'Publisher details can be added here.',
  about: 'Complex Studio is an interactive workbench for exploring real and complex mathematical functions with 2D plots, domain coloring, and 3D surfaces.',
  announcements: ['No announcements yet.'],
  patchNotes: ['Phase 1: robust view fitting, clearer display controls, project files, and expression preview.'],
  acknowledgements: ['Math.js for expression parsing and numerical evaluation.', 'Three.js for interactive WebGL rendering.', 'React and the open-source ecosystem used by this project.'],
  knownIssues: ['Sampling remains uniform. Some discontinuities may need higher resolution to reveal their local structure.'],
  credits: ['Complex Studio is designed for interactive mathematical visualization.'],
} as const;
