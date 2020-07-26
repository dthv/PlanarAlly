import { ServerPolygon } from "../comm/types/shapes";
import { GlobalPoint, getDistanceToSegment, Vector } from "../geom";
import { g2lx, g2ly, g2lz, g2l } from "../units";
import { getFogColour, rotateAroundPoint } from "../utils";
import { Shape } from "./shape";
import { BoundingRect } from "./boundingrect";

export class Polygon extends Shape {
    type = "polygon";
    _vertices: GlobalPoint[] = [];
    openPolygon = false;
    lineWidth: number;

    constructor(
        startPoint: GlobalPoint,
        vertices?: GlobalPoint[],
        fillColour?: string,
        strokeColour?: string,
        lineWidth?: number,
        openPolygon = false,
        uuid?: string,
    ) {
        super(startPoint, fillColour, strokeColour, uuid);
        this._vertices = vertices || [];
        this.openPolygon = openPolygon;
        this.lineWidth = lineWidth || 2;
    }

    get isClosed(): boolean {
        return !this.openPolygon;
    }

    get refPoint(): GlobalPoint {
        return this._refPoint;
    }
    set refPoint(point: GlobalPoint) {
        const delta = point.subtract(this._refPoint);
        this._refPoint = point;
        for (let i = 0; i < this._vertices.length; i++) this._vertices[i] = this._vertices[i].add(delta);
    }

    get vertices(): GlobalPoint[] {
        return [this._refPoint, ...this._vertices];
    }

    get uniqueVertices(): GlobalPoint[] {
        return this.vertices.filter((val, i, arr) => arr.findIndex(t => t.equals(val)) === i);
    }

    asDict(): ServerPolygon {
        return Object.assign(this.getBaseDict(), {
            vertices: this._vertices.map(v => v.asArray()),
            // eslint-disable-next-line @typescript-eslint/camelcase
            open_polygon: this.openPolygon,
            // eslint-disable-next-line @typescript-eslint/camelcase
            line_width: this.lineWidth,
        });
    }

    fromDict(data: ServerPolygon): void {
        super.fromDict(data);
        this._vertices = data.vertices.map(v => GlobalPoint.fromArray(v));
        this.openPolygon = data.open_polygon;
        this.lineWidth = data.line_width;
    }

    getBoundingBox(delta = 0): BoundingRect {
        let minx = this.vertices[0].x;
        let maxx = this.vertices[0].x;
        let miny = this.vertices[0].y;
        let maxy = this.vertices[0].y;
        for (const p of this.vertices.slice(1)) {
            if (p.x < minx) minx = p.x;
            if (p.x > maxx) maxx = p.x;
            if (p.y < miny) miny = p.y;
            if (p.y > maxy) maxy = p.y;
        }
        let bbox = new BoundingRect(
            new GlobalPoint(minx - delta, miny - delta),
            maxx - minx + 2 * delta,
            maxy - miny + 2 * delta,
        );
        bbox = bbox.center(rotateAroundPoint(bbox.center(), this.center(), this.angle));
        bbox.angle = this.angle;
        return bbox;
    }

    getPositionRepresentation(): number[][] {
        return this.vertices.map(v => v.asArray());
    }

    setPositionRepresentation(points: number[][]): void {
        this._vertices = points.slice(1).map(p => GlobalPoint.fromArray(p));
        super.setPositionRepresentation(points);
    }

    get points(): number[][] {
        const center = this.center();
        return this.vertices.map(point => [...rotateAroundPoint(point, center, this.angle)]);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        super.draw(ctx);

        const center = g2l(this.center());

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = g2lz(this.lineWidth);

        if (this.strokeColour === "fog") ctx.strokeStyle = getFogColour();
        else ctx.strokeStyle = this.strokeColour;
        if (this.fillColour === "fog") ctx.fillStyle = getFogColour();
        else ctx.fillStyle = this.fillColour;

        ctx.beginPath();
        ctx.moveTo(g2lx(this.vertices[0].x) - center.x, g2ly(this.vertices[0].y) - center.y);
        for (let i = 1; i <= this.vertices.length - (this.openPolygon ? 1 : 0); i++) {
            const vertex = this.vertices[i % this.vertices.length];
            ctx.lineTo(g2lx(vertex.x) - center.x, g2ly(vertex.y) - center.y);
        }
        if (!this.openPolygon) ctx.fill();
        ctx.stroke();
        super.drawPost(ctx);
    }

    contains(point: GlobalPoint, nearbyThreshold?: number): boolean {
        if (nearbyThreshold === undefined) nearbyThreshold = this.lineWidth;
        const bbox = this.getBoundingBox(nearbyThreshold);
        if (!bbox.contains(point)) return false;
        if (this.isClosed) return true;
        if (this.angle !== 0) point = rotateAroundPoint(point, this.center(), -this.angle);
        const vertices = this.uniqueVertices;
        for (const [i, v] of vertices.entries()) {
            const nv = vertices[(i + 1) % vertices.length];
            const distance = getDistanceToSegment(point, [v, nv]);
            if (distance <= nearbyThreshold) return true;
        }
        return false;
    }

    center(): GlobalPoint;
    center(centerPoint: GlobalPoint): void;
    center(centerPoint?: GlobalPoint): GlobalPoint | void {
        if (centerPoint === undefined) {
            const unique = this.uniqueVertices;
            const vertexAvg = unique
                .reduce((acc: Vector, val: GlobalPoint) => acc.add(new Vector(val.x, val.y)), new Vector(0, 0))
                .multiply(1 / unique.length);
            return GlobalPoint.fromArray([...vertexAvg]);
        }
        const oldCenter = this.center();
        this.refPoint = GlobalPoint.fromArray([...centerPoint.subtract(oldCenter.subtract(this.refPoint))]);
    }
    visibleInCanvas(canvas: HTMLCanvasElement): boolean {
        if (super.visibleInCanvas(canvas)) return true;
        return this.getBoundingBox().visibleInCanvas(canvas);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    snapToGrid(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    resizeToGrid(): void {}
    resize(resizePoint: number, point: GlobalPoint): number {
        if (resizePoint === 0) this._refPoint = point;
        else this._vertices[resizePoint - 1] = point;
        return resizePoint;
    }
}
