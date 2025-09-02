import { CommonModule } from '@angular/common';
import { Component, OnInit, inject  } from '@angular/core';
import { Github } from "../../services/github"

@Component({
  selector: 'app-sobre-mi',
  imports: [CommonModule],
  templateUrl: './sobre-mi.html',
  styleUrl: './sobre-mi.css'
})
export class SobreMi implements OnInit {
  private gh = inject(Github);

   ngOnInit(): void {
    this.gh.fetchUser('JoaquinCarbonaro');
  }

  // === Getters para tu template ===
  get loading() {
    return this.gh.loading();
  }
  get error() {
    return this.gh.error();
  }
  get githubData() {
    return this.gh.user();
  }

  recargar(): void {
    this.gh.fetchUser('JoaquinCarbonaro');
  }
}
