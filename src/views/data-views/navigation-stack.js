import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class NavigationStack extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.tabs = {
            settings: {
                $view: document.querySelector(`#view--settings`),
                $link: document.querySelector(`#link--settings`),
                children: {
                    settings: {
                        $view: document.querySelector(`#view--settings-settings`),
                        $link: document.querySelector(`#link--settings-settings`),
                    },
                    profile: {
                        $view: document.querySelector(`#view--settings-profile`),
                        $link: document.querySelector(`#link--settings-profile`),
                    }
                }
            },
            home: {
                $view: document.querySelector(`#view--home`),
                $link: document.querySelector(`#link--home`),
            },
            workouts: {
                $view: document.querySelector(`#view--workouts`),
                $link: document.querySelector(`#view--workouts`),

                children: {
                    workouts: {
                        $view: document.querySelector(`#view--workouts-workouts`),
                        $link: document.querySelector(`#link--workouts-workouts`),
                    },
                    editor: {
                        $view: document.querySelector(`#view--workouts-editor`),
                        $link: document.querySelector(`#link--workouts-editor`),
                    },
                    report: {
                        $view: document.querySelector(`#view--workouts-report`),
                        $link: document.querySelector(`#link--workouts-report`),
                    }
                }
            },
        };
        xf.sub(`action:nav`, this.onAction.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onAction(action) {
        console.log(action);

        if(action === 'settings') {
            this.switch('settings', this.tabs);
            return;
        }
        if(action === 'home') {
            this.switch('home', this.tabs);
            return;
        }
        if(action === 'workouts') {
            this.switch('workouts', this.tabs);
            return;
        }

        if(action === 'settings:settings') {
            this.switch('settings', this.tabs.settings.children);
            return;
        }
        if(action === 'settings:profile') {
            this.switch('profile', this.tabs.settings.children);
            models.api.auth.loadTurnstile();
            return;
        }

        if(action === 'workouts:workouts') {
            this.switch('workouts', this.tabs.workouts.children);
            return;
        }
        if(action === 'workouts:editor') {
            this.switch('editor', this.tabs.workouts.children);
            return;
        }
        if(action === 'workouts:report') {
            this.switch('report', this.tabs.workouts.children);
            return;
        }
    }
    switch(target, elements) {
        // prevent potential content flash
        // by first removing and only after that adding .active
        // if there is no target element this is not an error,
        // it means all content should be 'non-active'
        for(let prop in elements) {
            if(!(target === prop)) {
                elements[prop].$view.classList.remove('active');
                elements[prop].$link.classList.remove('active');
            }
        }
        if(target) {
            elements[target].$view.classList.add('active');
            elements[target].$link.classList.add('active');
        }
    }
}

customElements.define('navigation-stack', NavigationStack);

export { NavigationStack };
