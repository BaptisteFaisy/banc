/**
 * Les composants UI Kit 2, importés en un seul endroit.
 *
 * Why: Forge apps should import the Atlaskit packages they use rather than
 * the whole `@forge/react` meta-package — the latter pulls 3,6 Go and eleven
 * minutes of installation, which is incompatible with the five-minute CI
 * budget (règle du 24 octobre 2026). This file is the single seam: swapping
 * the visual layer later touches this file and nothing else.
 */
export { default as Button } from '@atlaskit/button';
export { default as EmptyState } from '@atlaskit/empty-state';
export { default as ModalDialog } from '@atlaskit/modal-dialog';
export { default as Table } from '@atlaskit/table';
export { default as Tabs, TabList, Tab, TabPanel } from '@atlaskit/tabs';
// Le paquet Atlaskit expose `RemovableTag` par défaut ; l'étiquette simple,
// celle qui porte un mot et un motif, est `SimpleTag`.
export { SimpleTag as Tag } from '@atlaskit/tag';
export { default as Tooltip } from '@atlaskit/tooltip';
