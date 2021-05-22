import FlexContainer from "./flex_container.js";
import appContext from "../../services/app_context.js";

export default class PaneContainer extends FlexContainer {
    constructor(widgetFactory) {
        super('row');

        this.counter = 0;

        this.widgetFactory = widgetFactory;
        this.widgets = {};

        this.class('pane-container-widget');
        this.css('flex-grow', '1');
    }

    async newTabOpenedEvent({noteContext}) {
        const widget = this.widgetFactory();

        const $renderedWidget = widget.render();

        $renderedWidget.attr("data-tab-id", noteContext.ntxId);

        $renderedWidget.on('click', () => appContext.tabManager.activateTab(noteContext.ntxId));

        this.$widget.append($renderedWidget);

        this.widgets[noteContext.ntxId] = widget;

        await widget.handleEvent('setNoteContext', { noteContext });

        this.child(widget);

        this.refresh();
    }

    async openNewPaneCommand() {
        const noteContext = await appContext.tabManager.openEmptyTab(null, 'root', appContext.tabManager.getActiveNoteContext().ntxId);

        await appContext.tabManager.activateTab(noteContext.ntxId);

        await noteContext.setEmpty();
    }

    async refresh() {
        this.toggleExt(true);
    }

    toggleInt(show) {} // not needed

    toggleExt(show) {
        const activeTabId = appContext.tabManager.getActiveNoteContext().getMainNoteContext().ntxId;

        for (const ntxId in this.widgets) {
            const noteContext = appContext.tabManager.getNoteContextById(ntxId);

            const widget = this.widgets[ntxId];
            widget.toggleExt(show && activeTabId && [noteContext.ntxId, noteContext.mainNtxId].includes(activeTabId));

            if (!widget.hasBeenAlreadyShown) {
                widget.handleEvent('activeTabChanged', {noteContext});
            }
        }
    }

    /**
     * widget.hasBeenAlreadyShown is intended for lazy loading of cached tabs - initial note switches of new tabs
     * are not executed, we're waiting for the first tab activation and then we update the tab. After this initial
     * activation further note switches are always propagated to the tabs.
     */
    handleEventInChildren(name, data) {
        if (['tabNoteSwitched', 'tabNoteSwitchedAndActivated'].includes(name)) {
            // this event is propagated only to the widgets of a particular tab
            const widget = this.widgets[data.noteContext.ntxId];

            if (!widget) {
                return Promise.resolve();
            }

            const promises = [];

            if (appContext.tabManager.getActiveNoteContext().getMainNoteContext() === data.noteContext.getMainNoteContext()) {
                promises.push(widget.handleEvent('activeTabChanged', data));
            }

            for (const subNoteContext of data.noteContext.getMainNoteContext().getAllSubNoteContexts()) {
                const subWidget = this.widgets[subNoteContext.ntxId];

                if (!subWidget) {
                    continue;
                }

                if (subNoteContext !== data.noteContext && !subWidget.hasBeenAlreadyShown) {
                    promises.push(widget.handleEvent('activeTabChanged', {noteContext: subNoteContext}));
                    continue;
                }

                if (subNoteContext === data.noteContext && (subWidget.hasBeenAlreadyShown || name === 'tabNoteSwitchedAndActivated')) {
                    subWidget.hasBeenAlreadyShown = true;

                    promises.push(widget.handleEvent('tabNoteSwitched', data));
                }
            }

            if (name === 'tabNoteSwitchedAndActivated') {
                this.toggleExt(true);
            }

            return Promise.all(promises);
        }

        if (name === 'activeTabChanged') {
            const promises = [];

            for (const subNoteContext of data.noteContext.getMainNoteContext().getAllSubNoteContexts()) {
                console.log("subNoteContext", subNoteContext);

                const widget = this.widgets[subNoteContext.ntxId];

                if (!widget.hasBeenAlreadyShown) {
                    widget.hasBeenAlreadyShown = true;

                    promises.push(widget.handleEvent(name, {noteContext: subNoteContext}));
                }
            }

            this.toggleExt(true);

            return Promise.all(promises);
        } else {
            return super.handleEventInChildren(name, data);
        }
    }
}
