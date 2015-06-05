import c from 'cassowary/bin/c';
import VisualFormat from './VisualFormat';
import Attribute from './Attribute';
import Relation from './Relation';



function _getConst(name, value) {
    const vr = new c.Variable({value: value});
    this.solver.addConstraint(new c.StayConstraint(vr, c.Strength.required, 0));
    return vr;
}

function _getAttr(viewName, attr) {
    this.views[(viewName || '__parentview')] = this.views[(viewName || '__parentview')] || {
        name: viewName,
        attr: {}
    };
    const view = this.views[(viewName || '__parentview')];
    if (view.attr[attr]) {
        return view.attr[attr];
    }
    switch (attr) {
        case Attribute.LEFT:
        case Attribute.TOP:
        case Attribute.WIDTH:
        case Attribute.HEIGHT:
            view.attr[attr] = new c.Variable({value: 0});
            if (!view.name) {
                if ((attr === Attribute.WIDTH) || (attr === Attribute.HEIGHT)) {
                    this.solver.addEditVar(view.attr[attr]);
                }
                else {
                    this.solver.addConstraint(new c.StayConstraint(view.attr[attr], c.Strength.required, 0));
                }
            }
            break;
        case Attribute.RIGHT:
            _getAttr.call(this, viewName, Attribute.LEFT);
            _getAttr.call(this, viewName, Attribute.WIDTH);
            view.attr[Attribute.RIGHT] = new c.Variable();
            this.solver.addConstraint(new c.Equation(view.attr[Attribute.RIGHT], c.plus(view.attr[Attribute.LEFT], view.attr[Attribute.WIDTH])));
            break;
        case Attribute.BOTTOM:
            _getAttr.call(this, viewName, Attribute.TOP);
            _getAttr.call(this, viewName, Attribute.HEIGHT);
            view.attr[Attribute.BOTTOM] = new c.Variable();
            this.solver.addConstraint(new c.Equation(view.attr[Attribute.BOTTOM], c.plus(view.attr[Attribute.TOP], view.attr[Attribute.HEIGHT])));
            break;
        case Attribute.CENTERX:
            _getAttr.call(this, viewName, Attribute.LEFT);
            _getAttr.call(this, viewName, Attribute.WIDTH);
            view.attr[Attribute.CENTERX] = new c.Variable();
            this.solver.addConstraint(new c.Equation(view.attr[Attribute.CENTERX], c.plus(view.attr[Attribute.LEFT], c.divide(view.attr[Attribute.WIDTH], 2))));
            break;
        case Attribute.CENTERY:
            _getAttr.call(this, viewName, Attribute.TOP);
            _getAttr.call(this, viewName, Attribute.HEIGHT);
            view.attr[Attribute.CENTERY] = new c.Variable();
            this.solver.addConstraint(new c.Equation(view.attr[Attribute.CENTERY], c.plus(view.attr[Attribute.TOP], c.divide(view.attr[Attribute.HEIGHT], 2))));
            break;
    }
    return view.attr[attr];
}

function _addConstraint(constraint) {
    this.constraints.push(constraint);
    const attr1 = _getAttr.call(this, constraint.view1, constraint.attr1);
    const attr2 = (constraint.attr2 === Attribute.CONST) ? _getConst.call(this, undefined, constraint.constant) : _getAttr.call(this, constraint.view2, constraint.attr2);
    let relation;
    switch (constraint.relation) {
        case Relation.LEQ:
            //relation = new c.Inequality(attr1, c.LEQ, c.plus(attr2, )
            break;
        case Relation.EQU:
            if (((constraint.multiplier === 1) && !constraint.constant) || (constraint.attr2 === Attribute.CONST)) {
                relation = new c.Equation(attr1, attr2);
            }
            else if ((constraint.multiplier !== 1) && constraint.constant) {
                throw 'todo';
            }
            else if (constraint.constant) {
                relation = new c.Equation(attr2, c.plus(attr1, constraint.constant));
            }
            else {
                throw 'todo';
            }
            break;
        case Relation.GEQ:
            break;
        default:
            throw 'Invalid relation specified: ' + constraint.relation;
    }
    this.solver.addConstraint(relation);
}

class View {

    /**
     * @class View
     * @param {Object} [options] Configuration options.
     * @param {Number} [options.width] Initial width of the view.
     * @param {Number} [options.height] Initial height of the view.
     * @param {Object|Array} [options.constraints] One or more constraint definitions.
     * @param {String|Array} [options.visualFormat] Visual format string or array of vfl strings.
     */
    constructor(options) {
        this.solver = new c.SimplexSolver();
        this.views = {};
        this.constraints = [];
        if (options) {
            if ((options.width !== undefined) || (options.height !== undefined)) {
                this.setSize(options.width, options.height);
            }
            if (options.constraints) {
                this.addConstraints(options.constraints);
            }
            if (options.visualFormat) {
                this.addVisualFormat(options.visualFormat);
            }
        }
    }

    /**
     * Sets the width and height of the view.
     *
     * @param {Number} width Width of the view.
     * @param {Number} height Height of the view.
     * @return {AutoLayout} this
     */
    setSize(width, height /*, depth*/) {
        if ((this._width === width) &&
            (this._height === height)) {
            return undefined;
        }
        if ((width !== undefined) && (this._width !== width)) {
            this._width = width;
            this.solver.suggestValue(_getAttr.call(this, undefined, Attribute.WIDTH), this._width);
        }
        if ((height !== undefined) && (this._height !== height)) {
            this._height = height;
            this.solver.suggestValue(_getAttr.call(this, undefined, Attribute.HEIGHT), this._height);
        }
        this.solver.resolve();
        return this;
    }

    /**
     * Adds one or more constraint definitions.
     *
     * A constraint definition has the following format:
     *
     * ```javascript
     * constraint: {
     *   view1: {String},
     *   attr1: {AutoLayout.Attribute},
     *   relation: {AutoLayout.Relation},
     *   view2: {String},
     *   attr2: {AutoLayout.Attribute},
     *   multiplier: {Number},
     *   constant: {Number}
     * }
     * ```
     * @param {Object|Array} constraints One or more constraint definitions.
     * @return {AutoLayout} this
     */
    addConstraint(constraint) {
        if (Array.isArray(constraint)) {
            for (var i = 0; i < constraint.length; i++) {
                _addConstraint.call(this, constraint[i]);
            }
        }
        else {
            _addConstraint.call(this, constraint);
        }
        return this;
    }

    /**
     * Adds one or more constraints from a visual-format definition.
     * See `VisualFormat.parse`.
     *
     * @param {String|Array} visualFormat Visual format string or array of vfl strings.
     * @return {AutoLayout} this
     */
    addVisualFormat(visualFormat) {
        return this.addConstraint(VisualFormat.parse(visualFormat));
    }

    /**
     * Gets a calculated attribute value.
     *
     * @param {String} subView Child view name (when undefined returns attributes for this value itself such as width and height).
     * @param {Attribute|String} attr Attribute to get the value for.
     * @return {Number} value or undefined
     */
    get(subView, attr) {
        subView = subView || '__parentview';
        if (!this.views[subView]) {
            return undefined;
        }
        _getAttr.call(this, subView, attr);
        return this.views[subView].attr[attr] ? this.views[subView].attr[attr].value : undefined;
    }
}

export {View as default};
