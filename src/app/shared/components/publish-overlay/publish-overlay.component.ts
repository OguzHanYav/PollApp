import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-publish-overlay',
  standalone: true,
  templateUrl: './publish-overlay.component.html',
  styleUrl: './publish-overlay.component.scss'
})
export class PublishOverlayComponent {
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
