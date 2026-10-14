import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
}   from 'typeorm';
import { Project } from './project.entity';
import { Buildlog } from './buildlog.entity';

@Entity('lookout_sessions')
export class LookoutSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;


    @Column({ name: 'project_id'})
    projectId: string;

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ type: 'varchar', name: 'lookout_session_id'})
    lookoutSessionId: string;

    @Column({ type: 'varchar' })
    token: string;

    @Column({ name: 'buildlog_id', type: 'uuid', nullable: true })
    buildlogId: string | null;

    @ManyToOne(() => Buildlog, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'buildlog_id' })
    buildlog: Buildlog | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}

