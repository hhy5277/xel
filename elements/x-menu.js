
// @copyright
//   © 2016-2017 Jarosław Foksa
// @doc
//   http://w3c.github.io/aria-practices/#menu

"use strict";

{
  let {sleep, getTimeStamp} = Xel.utils.time;
  let {closest, html} = Xel.utils.element;
  let {abs} = Math;

  let clientPadding = 7;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-menu.css" data-vulcanize>

      <main id="main" role="presentation">
        <slot id="slot"></slot>
      </main>
    </template>
  `;

  // @events
  //   open XMenu
  //   close XMenu
  class XMenuElement extends HTMLElement {
    constructor() {
      super();

      this._delayPoints = [];
      this._delayTimeoutID = null;
      this._lastDelayPoint = null;

      this._lastScrollTop = 0;
      this._isPointerOverMenuBlock = false;
      this._expandWhenScrolled = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("pointerover", (event) => this._onPointerOver(event));
      this.addEventListener("pointerout", (event) => this._onPointerOut(event));
      this.addEventListener("pointermove", (event) => this._onPointerMove(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
      this.addEventListener("wheel", (event) => this._onWheel(event), {passive: true});
      this["#main"].addEventListener("scroll", (event) => this._onScroll(event), {passive: true});
    }

    connectedCallback() {
      this.setAttribute("role", "menu");
      this.setAttribute("aria-hidden", !this.opened);
      this.setAttribute("tabindex", "0");
    }

    attributeChangedCallback(name) {
      if (name === "opened") {
        this._onOpenedAttributeChange();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["opened"];
    }

    // @info
    //   Whether the menu is shown on screen.
    // @type
    //   boolean
    // @readonly
    // @attribute
    get opened() {
      return this.hasAttribute("opened");
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onOpenedAttributeChange() {
      this.setAttribute("aria-hidden", !this.opened);
    }

    _onPointerDown(event) {
      if (event.target === this || event.target.localName === "hr") {
        event.stopPropagation();
      }
    }

    _onPointerOver(event) {
      if (this._isClosing() || event.pointerType !== "mouse") {
        return;
      }

      if (event.target.closest("x-menu") === this) {
        if (this._isPointerOverMenuBlock === false) {
          this._onMenuBlockPointerEnter();
        }

        // Focus and expand the menu item under pointer and collapse other items
        {
          let item = event.target.closest("x-menuitem");

          if (item && item.disabled === false && item.closest("x-menu") === this) {
            if (item.matches(":focus") === false) {



              this._delay( async () => {
                let otherItem = this.querySelector(":scope > x-menuitem:focus");

                if (otherItem) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    // otherItem.removeAttribute("expanded");
                    otherSubmenu.close();
                  }
                }

                item.focus();

                let menu = item.closest("x-menu");
                let submenu = item.querySelector("x-menu");
                let otherItems = [...this.querySelectorAll(":scope > x-menuitem")].filter($0 => $0 !== item);

                if (submenu) {
                  await sleep(60);

                  if (item.matches(":focus") && submenu.opened === false) {
                    submenu.openNextToElement(item, "horizontal");
                  }
                }

                for (let otherItem of otherItems) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    otherSubmenu.close();
                  }
                }
              })
            }
          }
          else {
            this._delay(() => {
              this.focus();
            });
          }
        }
      }
    }

    _onPointerOut(event) {
      // @bug: event.relatedTarget leaks shadowDOM, so we have to use closest() utility function
      if (!event.relatedTarget || closest(event.relatedTarget, "x-menu") !== this) {
        if (this._isPointerOverMenuBlock === true) {
          this._onMenuBlockPointerLeave();
        }
      }
    }

    _onMenuBlockPointerEnter() {
      if (this._isClosing()) {
        return;
      }

      this._isPointerOverMenuBlock = true;
      this._clearDelay();
    }

    _onMenuBlockPointerLeave() {
      if (this._isClosing()) {
        return;
      }

      this._isPointerOverMenuBlock = false;
      this._clearDelay();
      this.focus();
    }

    _onPointerMove(event) {
      this._delayPoints.push({
        x: event.clientX,
        y: event.clientY
      });

      if (this._delayPoints.length > 3) {
        this._delayPoints.shift();
      }
    }

    _onWheel(event) {
      if (event.target.closest("x-menu") === this) {
        this._isPointerOverMenuBlock = true;
      }
      else {
        this._isPointerOverMenuBlock = false;
      }
    }

    _onScroll(event) {
      if (this._expandWhenScrolled) {
        let delta = this["#main"].scrollTop - this._lastScrollTop;
        this._lastScrollTop = this["#main"].scrollTop;

        if (getTimeStamp() - this._openedTimestamp > 100) {
          let menuRect = this.getBoundingClientRect();

          if (delta < 0) {
            if (menuRect.bottom + abs(delta) <= window.innerHeight - clientPadding) {
              this.style.height = (menuRect.height + abs(delta)) + "px";
            }
            else {
              this.style.height = (window.innerHeight - menuRect.top - clientPadding) + "px";
            }
          }
          else if (delta > 0) {
            let {top, left, height} = getComputedStyle(this);

            if (menuRect.top - abs(delta) >= clientPadding) {
              this.style.top = (parseFloat(top) - abs(delta)) + "px";
              this.style.height = (parseFloat(height) + abs(delta)) + "px";

              this["#main"].scrollTop = 0;
              this._lastScrollTop = 0;
            }
            else {
              this.style.top = clientPadding + "px";
              this.style.height = (window.innerHeight - menuRect.top - clientPadding) + "px";
            }
          }
        }
      }
    }

    _onKeyDown(event) {
      if (this._isClosing()) {
        event.preventDefault();
        event.stopPropagation();
      }

      else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        this.focusPreviousMenuItem();
      }

      else if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        this.focusNextMenuItem();
      }

      else if (event.code === "ArrowRight" || event.code === "Enter" || event.code === "Space") {
        let focusedItem = this.querySelector("x-menuitem:focus");

        if (focusedItem) {
          let submenu = focusedItem.querySelector("x-menu");

          if (submenu) {
            event.preventDefault();
            event.stopPropagation();

            if (submenu.opened === false) {
              submenu.openNextToElement(focusedItem, "horizontal");
            }

            let submenuFirstItem = submenu.querySelector("x-menuitem:not([disabled]):not([hidden])");

            if (submenuFirstItem) {
              submenuFirstItem.focus();
            }
          }
        }
      }

      else if (event.code === "ArrowLeft") {
        let focusedItem = this.querySelector("x-menuitem:focus");

        if (focusedItem) {
          let parentMenu = focusedItem.closest("x-menu");
          let parentItem = parentMenu.closest("x-menuitem");

          if (parentItem && parentItem.closest("x-menu")) {
            event.preventDefault();
            event.stopPropagation();

            parentItem.focus();
            this.close();
          }
        }
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Open the menu so that overElement (belonging to the menu) is positioned directly over underElement.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (HTMLElement, HTMLElement) => Promise<>
    openOverElement(underElement, overElement) {
      return new Promise( async (resolve) => {
        let items = this.querySelectorAll(":scope > x-menuitem");

        if (items.length > 0) {
          this._resetInlineStyles();
          this.setAttribute("opened", "");
          this._expandWhenScrolled = true;
          this._openedTimestamp = getTimeStamp();

          let menuItem = [...items].find((item) => item.contains(overElement)) || items[0];
          let menuBounds = this.getBoundingClientRect();
          let underElementBounds = underElement.getBoundingClientRect();
          let overElementBounds = overElement.getBoundingClientRect();

          menuItem.focus();

          // Adjust the "top" and "left" values in case the menu is not positioned in the client space
          // (this could be the case when e.g. it is inside another fixed positioned element such as a drawer).
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top !== 0 || menuBounds.left !== 0) {
              this.style.top = `${-menuBounds.top}px`;
              this.style.left = `${-menuBounds.left}px`;
            }
          }

          // Position the menu so that the underElement is directly above the overLabel
          {
            let menuBounds = this.getBoundingClientRect();

            this.style.left = (underElementBounds.x - (overElementBounds.x - menuBounds.x)) + "px";
            this.style.top = (underElementBounds.y - (overElementBounds.y - menuBounds.y)) + "px";
          }

          // Move the menu right if it overflows the left client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left < clientPadding) {
              this.style.left = `${clientPadding}px`;
            }
          }

          // Reduce menu height and move it down if it overflows the top client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top < clientPadding) {
              let height = (menuBounds.height + menuBounds.top - clientPadding);

              this.style.height = height + "px";
              this.style.top = `${clientPadding}px`;
              this["#main"].scrollTop = 9999;
            }
          }

          // Reduce menu height if it overflows the bottom client bound
          // Reduce menu width if it overflows the right client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.bottom + clientPadding > window.innerHeight) {
              let overflow = menuBounds.bottom - window.innerHeight;
              let height = menuBounds.height - overflow - clientPadding;
              this.style.height = height + "px";
            }

            if (menuBounds.right + clientPadding > window.innerWidth) {
              let overflow = menuBounds.right - window.innerWidth;
              let width = menuBounds.width - overflow - clientPadding;
              this.style.width = `${width}px`;
            }
          }

          // Animate the menu block
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              let blockBounds = this.getBoundingClientRect();
              let originY = underElementBounds.y + underElementBounds.height/2 - blockBounds.top;

              await this.animate(
                {
                  transform: ["scaleY(0)", "scaleY(1)"],
                  transformOrigin: [`0 ${originY}px`, `0 ${originY}px`]
                },
                { duration, easing }
              ).finished;
            }
          }

          this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
        }

        resolve();
      });
    }

    // @info
    //   Open the menu over the given <x-label> element.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (XMenuItem) => Promise<>
    openOverLabel(underLabel) {
      return new Promise( async (resolve) => {
        let items = this.querySelectorAll(":scope > x-menuitem");

        if (items.length > 0) {
          this._resetInlineStyles();
          this.setAttribute("opened", "");
          this._expandWhenScrolled = true;
          this._openedTimestamp = getTimeStamp();

          let item = [...items].find((item) => {
            let itemLabel = item.querySelector("x-label");
            return (itemLabel && itemLabel.textContent === underLabel.textContent) ? true : false;
          });

          if (!item) {
            item = items[0];
          }

          let overLabel = item.querySelector("x-label");
          let menuBounds = this.getBoundingClientRect();
          let underLabelBounds = underLabel.getBoundingClientRect();
          let overLabelBounds = overLabel ? overLabel.getBoundingClientRect() : item.getBoundingClientRect();

          item.focus();

          // Adjust the "top" and "left" values in case the menu is not positioned in the client space
          // (this could be the case when e.g. it is inside another fixed positioned element such as a drawer).
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top !== 0 || menuBounds.left !== 0) {
              this.style.top = `${-menuBounds.top}px`;
              this.style.left = `${-menuBounds.left}px`;
            }
          }

          // Position the menu so that the underLabel is directly above the overLabel
          {
            let menuBounds = this.getBoundingClientRect();

            this.style.left = (underLabelBounds.x - (overLabelBounds.x - menuBounds.x)) + "px";
            this.style.top = (underLabelBounds.y - (overLabelBounds.y - menuBounds.y)) + "px";
          }

          // Move the menu right if it overflows the left client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left < clientPadding) {
              this.style.left = `${clientPadding}px`;
            }
          }

          // Reduce menu height and move it down if it overflows the top client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top < clientPadding) {
              let height = (menuBounds.height + menuBounds.top - clientPadding);

              this.style.height = height + "px";
              this.style.top = `${clientPadding}px`;
              this["#main"].scrollTop = 9999;
            }
          }

          // Reduce menu height if it overflows the bottom client bound
          // Reduce menu width if it overflows the right client bound
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.bottom + clientPadding > window.innerHeight) {
              let overflow = menuBounds.bottom - window.innerHeight;
              let height = menuBounds.height - overflow - clientPadding;
              this.style.height = height + "px";
            }

            if (menuBounds.right + clientPadding > window.innerWidth) {
              let overflow = menuBounds.right - window.innerWidth;
              let width = menuBounds.width - overflow - clientPadding;
              this.style.width = `${width}px`;
            }
          }

          // Animate the menu block
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              let blockBounds = this.getBoundingClientRect();
              let originY = underLabelBounds.y + underLabelBounds.height/2 - blockBounds.top;

              await this.animate(
                {
                  transform: ["scaleY(0)", "scaleY(1)"],
                  transformOrigin: [`0 ${originY}px`, `0 ${originY}px`]
                },
                { duration, easing }
              ).finished;
            }
          }

          this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
        }

        resolve();
      });
    }

    // @info
    //   Open the menu next the given menu item.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (XMenuItem, string) => Promise
    async openNextToElement(element, direction = "horizontal", offset = 0) {
      return new Promise(async (resolve) => {
        this._expandWhenScrolled = false;
        this._openedTimestamp = getTimeStamp();

        this._resetInlineStyles();
        this.setAttribute("opened", "");
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

        if (element.localName === "x-menuitem") {
          element.setAttribute("expanded", "");
        }

        let elementBounds = element.getBoundingClientRect();

        if (direction === "horizontal") {
          this.style.top = `${elementBounds.top}px`;
          this.style.left = `${elementBounds.left + elementBounds.width + offset}px`;

          let side = "right";

          // Reduce menu size if it does not fit on screen
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.width > window.innerWidth - 10) {
              this.style.width = `${window.innerWidth - 10}px`;
            }

            if (menuBounds.height > window.innerHeight - 10) {
              this.style.height = `${window.innerHeight - 10}px`;
            }
          }

          // Move the menu horizontally if it overflows the right screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left + menuBounds.width + clientPadding > window.innerWidth) {
              // Move menu to the left side of the element if there is enough space to fit it in
              if (elementBounds.left > menuBounds.width + clientPadding) {
                this.style.left = `${elementBounds.left - menuBounds.width}px`;
                side = "left";
              }
              // ... otherwise move menu to the screen edge
              else {
                // Move menu to the left screen edge
                if (elementBounds.left > window.innerWidth - (elementBounds.left + elementBounds.width)) {
                  this.style.left = `${clientPadding}px`;
                  side = "left";
                }
                // Move menu to the right screen edge
                else {
                  this.style.left = `${window.innerWidth - menuBounds.width - clientPadding}px`;
                  side = "right";
                }
              }
            }
          }

          // Move the menu vertically it overflows the bottom screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top + menuBounds.height + clientPadding > window.innerHeight) {
              let bottomOverflow = (menuBounds.top + menuBounds.height + clientPadding) - window.innerHeight;
              this.style.top = `${menuBounds.top - bottomOverflow}px`;
            }
          }

          // Animate the menu
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              await this.animate(
                {
                  transform: ["scale(0, 0)", "scale(1, 1)"],
                  transformOrigin: [side === "left" ? "100% 0" : "0 0", side === "left" ? "100% 0" : "0 0"]
                },
                { duration, easing }
              ).finished;
            }
          }
        }

        else if (direction === "vertical") {
          this.style.top = `${elementBounds.top + elementBounds.height + offset}px`;
          this.style.left = `${elementBounds.left}px`;

          // Reduce menu size
          {
            let menuBounds = this.getBoundingClientRect();

            // Reduce menu width if it is bigger than screen width
            if (menuBounds.width > window.innerWidth - 10) {
              this.style.width = `${window.innerWidth - 10}px`;
            }

            // Reduce menu height if it overflows bottom screen edge
            if (menuBounds.top + menuBounds.height + clientPadding > window.innerHeight) {
              let height = window.innerHeight - (elementBounds.top + elementBounds.height) - 10;
              this.style.height = `${height}px`;
            }
          }

          // Float the menu to the right element edge if the menu overflows right screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left + menuBounds.width + clientPadding > window.innerWidth) {
              this.style.left = `${elementBounds.left + elementBounds.width - menuBounds.width}px`;
            }
          }

          // Float the menu to the left screen edge if it overflows the left screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left < clientPadding) {
              this.style.left = `${clientPadding}px`;
            }
          }

          // Animate the menu
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              await this.animate(
                {
                  transform: ["scale(1, 0)", "scale(1, 1)"],
                  transformOrigin: ["0 0", "0 0"]
                },
                { duration, easing }
              ).finished;
            }
          }
        }

        resolve();
      });
    }

    // @info
    //   Open the menu at given client point.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (number, number) => Promise
    openAtPoint(left, top) {
      return new Promise( async (resolve) => {
        this._expandWhenScrolled = false;
        this._openedTimestamp = getTimeStamp();

        this._resetInlineStyles();
        this.style.left = `${left}px`;
        this.style.top = `${top}px`;
        this.setAttribute("opened", "");
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

        let menuBounds = this.getBoundingClientRect();

        // Adjust the "top" and "left" values in case the menu is not positioned in the client space
        // (this could be the case when e.g. it is inside another fixed positioned element such as a drawer).
        {
          if (menuBounds.top !== top || menuBounds.left !== left) {
            top -= (menuBounds.top - top);
            left -= (menuBounds.left - left);

            this.style.top = `${top}px`;
            this.style.left = `${left}px`;

            menuBounds = this.getBoundingClientRect();
          }
        }

        // If menu overflows right screen border then move it to the opposite side
        if (menuBounds.left + menuBounds.width > window.innerWidth) {
          left = left - menuBounds.width;
          this.style.left = `${left}px`;
          menuBounds = this.getBoundingClientRect();
        }

        // If menu overflows bottom screen border then move it up
        if (menuBounds.top + menuBounds.height + clientPadding > window.innerHeight) {
          top = top + window.innerHeight - (menuBounds.top + menuBounds.height) - clientPadding;
          this.style.top = `${top}px`;
          menuBounds = this.getBoundingClientRect();

          // If menu now overflows top screen border then make it stretch to the whole available vertical space

          if (menuBounds.top < 0) {
            top = top + menuBounds.top + clientPadding;
            this.style.top = `${top}px`;
            this.style.height = `${window.innerHeight - 10}px`;
          }
        }

        // Animate the menu
        {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = this._parseTransistion(transition);

          if (property === "transform") {
            await this.animate(
              {
                transform: ["scale(0)", "scale(1)"],
                transformOrigin: ["0 0", "0 0"]
              },
              {
                duration: 80,
                easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
              }
            ).finished;
          }
        }

        resolve();
      });
    }

    // @info
    //   Close the menu.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (boolean) => Promise
    close(animate = true) {
      return new Promise(async (resolve) => {
        if (this.opened) {
          this.removeAttribute("opened");
          this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

          let item = this.closest("x-menuitem");

          if (item) {
            item.removeAttribute("expanded");
          }

          if (animate) {
            this.setAttribute("animating", "");

            let transition = getComputedStyle(this).getPropertyValue("--close-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "opacity") {
              await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
            }

            this.removeAttribute("animating");
          }

          for (let item of this.querySelectorAll(":scope > x-menuitem")) {
            let submenu = item.querySelector("x-menu[opened]");

            if (submenu) {
              submenu.close();
            }
          }
        }

        resolve();
      });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    focusNextMenuItem() {
      let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

      if (refItem) {
        let nextItem = null;

        for (let item = refItem.nextElementSibling; item; item = item.nextElementSibling) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            nextItem = item;
            break;
          }
        }

        if (nextItem === null) {
          for (let item of refItem.parentElement.children) {
            if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
              nextItem = item;
              break;
            }
          }
        }

        if (nextItem) {
          nextItem.focus();

          let menu = refItem.querySelector("x-menu");

          if (menu) {
            menu.close();
          }
        }
      }
      else {
        this.focusFirstMenuItem();
      }
    }

    focusPreviousMenuItem() {
      let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

      if (refItem) {
        let previousItem = null;

        for (let item = refItem.previousElementSibling; item; item = item.previousElementSibling) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            previousItem = item;
            break;
          }
        }

        if (previousItem === null) {
          for (let item of [...refItem.parentElement.children].reverse()) {
            if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
              previousItem = item;
              break;
            }
          }
        }

        if (previousItem) {
          previousItem.focus();

          let menu = refItem.querySelector("x-menu");

          if (menu) {
            menu.close();
          }
        }
      }
      else {
        this.focusLastMenuItem();
      }
    }

    focusFirstMenuItem() {
      let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
      let firstItem = items[0] || null;

      if (firstItem) {
        firstItem.focus();
      }
    }

    focusLastMenuItem() {
      let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
      let lastItem = (items.length > 0) ? items[items.length-1] : null;

      if (lastItem) {
        lastItem.focus();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @doc
    //   http://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown
    _delay(callback) {
      let tolerance = 75;
      let fullDelay = 300;
      let delay = 0;
      let direction = "right";

      {
        let point = this._delayPoints[this._delayPoints.length - 1];
        let prevPoint = this._delayPoints[0];
        let openedSubmenu = this.querySelector("x-menu[opened]");

        if (openedSubmenu && point) {
          if (!prevPoint) {
            prevPoint = point;
          }

          let bounds = this.getBoundingClientRect();

          let upperLeftPoint  = {x: bounds.left, y: bounds.top - tolerance };
          let upperRightPoint = {x: bounds.left + bounds.width, y: upperLeftPoint.y };
          let lowerLeftPoint  = {x: bounds.left, y: bounds.top + bounds.height + tolerance};
          let lowerRightPoint = {x: bounds.left + bounds.width, y: lowerLeftPoint.y };

          let proceed = true;

          if (
            prevPoint.x < bounds.left || prevPoint.x > lowerRightPoint.x ||
            prevPoint.y < bounds.top  || prevPoint.y > lowerRightPoint.y
          ) {
            proceed = false;
          }

          if (
            this._lastDelayPoint &&
            point.x === this._lastDelayPoint.x &&
            point.y === this._lastDelayPoint.y
          ) {
            proceed = false;
          }

          if (proceed) {
            let decreasingCorner;
            let increasingCorner;

            if (direction === "right") {
              decreasingCorner = upperRightPoint;
              increasingCorner = lowerRightPoint;
            }
            else if (direction === "left") {
              decreasingCorner = lowerLeftPoint;
              increasingCorner = upperLeftPoint;
            }
            else if (direction === "below") {
              decreasingCorner = lowerRightPoint;
              increasingCorner = lowerLeftPoint;
            }
            else if (direction === "above") {
              decreasingCorner = upperLeftPoint;
              increasingCorner = upperRightPoint;
            }

            let getSlope = (a, b) => (b.y - a.y) / (b.x - a.x);
            let decreasingSlope = getSlope(point, decreasingCorner);
            let increasingSlope = getSlope(point, increasingCorner);
            let prevDecreasingSlope = getSlope(prevPoint, decreasingCorner);
            let prevIncreasingSlope = getSlope(prevPoint, increasingCorner);

            if (decreasingSlope < prevDecreasingSlope && increasingSlope > prevIncreasingSlope) {
              this._lastDelayPoint = point;
              delay = fullDelay;
            }
            else {
              this._lastDelayPoint = null;
            }
          }
        }
      }

      if (delay > 0) {
        this._delayTimeoutID = setTimeout(() => {
          this._delay(callback);
        }, delay);
      }
      else {
        callback();
      }
    }

    _clearDelay() {
      if (this._delayTimeoutID) {
        clearTimeout(this._delayTimeoutID);
        this._delayTimeoutID = null;
      }
    }

    _resetInlineStyles() {
      this.style.position = "fixed";
      this.style.top = "0px";
      this.style.left = "0px";
      this.style.width = null;
      this.style.height = null;
      this.style.minWidth = null;
      this.style.maxWidth = null;
    }

    // @info
    //   Whether this or any ancestor menu is closing
    // @type
    //   Boolean
    _isClosing() {
      return this.matches("*[closing], *[closing] x-menu");
    }

    // @info
    //   Parse the value of CSS transition property.
    // @type
    //   (string) => [string, number, string]
    _parseTransistion(string) {
      let [rawDuration, property, ...rest] = string.trim().split(" ");
      let duration = parseFloat(rawDuration);
      let easing = rest.join(" ");
      return [property, duration, easing];
    }
  }

  customElements.define("x-menu", XMenuElement);
}