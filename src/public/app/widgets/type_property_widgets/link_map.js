import NoteContextAwareWidget from "../note_context_aware_widget.js";
import froca from "../../services/froca.js";

const TPL = `
<div class="link-map-widget">
    <div class="link-map-container" style="height: 300px;"></div>
</div>`;

let linkMapContainerIdCtr = 1;

export default class LinkMapWidget extends NoteContextAwareWidget {
    static getType() { return "link-map"; }

    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: 'Link Map',
            icon: 'bx bx-network-chart'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();
    }

    async refreshWithNote(note) {
        this.$widget.html(TPL);

        const $linkMapContainer = this.$widget.find('.link-map-container');
        $linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);

        const LinkMapServiceClass = (await import('../../services/link_map.js')).default;

        this.linkMapService = new LinkMapServiceClass(note, $linkMapContainer, {
            maxDepth: 3,
            zoom: 0.6,
            stopCheckerCallback: () => this.noteId !== note.noteId // stop when current note is not what was originally requested
        });

        await this.linkMapService.render();
    }

    cleanup() {
        if (this.linkMapService) {
            this.linkMapService.cleanup();
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'relation' && (attr.noteId === this.noteId || attr.value === this.noteId))) {
            this.noteSwitched();
        }

        const changedNoteIds = loadResults.getNoteIds();

        if (changedNoteIds.length > 0) {
            const $linkMapContainer = this.$widget.find('.link-map-container');

            for (const noteId of changedNoteIds) {
                const note = froca.notes[noteId];

                if (note) {
                    $linkMapContainer.find(`a[data-note-path="${noteId}"]`).text(note.title);
                }
            }
        }
    }
}
