// Barrel adelgazado a tipos: los datos (volumes, detailedStories,
// spansToVolumes) y componentes se importan por ruta profunda para no arrastrar
// ~3000 líneas + audio al importar un tipo. Sin importadores del barrel completo.
export * from './types';
